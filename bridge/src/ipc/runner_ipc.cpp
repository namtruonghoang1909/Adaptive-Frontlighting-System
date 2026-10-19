#include "afs_bridge/runner_ipc.hpp"

#include <algorithm>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <cstring>
#include <iostream>
#include <map>
#include <limits>
#include <mutex>
#include <stdexcept>
#include <sys/socket.h>
#include <poll.h>
#include <signal.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <sys/time.h>
#include <unistd.h>
#include <variant>

namespace afs_bridge {
namespace {
constexpr std::size_t kMaxPacket = 64 * 1024;
constexpr std::size_t kMaxObjects = 128;
volatile sig_atomic_t shutdown_requested=0;
void request_shutdown(int) { shutdown_requested=1; }

struct Json {
    using Array = std::vector<Json>;
    using Object = std::map<std::string, Json>;
    std::variant<std::nullptr_t, bool, double, std::uint64_t, std::string, Array, Object> value;
    const Json& at(const std::string& key) const {
        const auto* object = std::get_if<Object>(&value);
        if (!object) throw std::runtime_error("expected object");
        const auto it = object->find(key);
        if (it == object->end()) throw std::runtime_error("missing field: " + key);
        return it->second;
    }
    const Array& array() const {
        const auto* p = std::get_if<Array>(&value);
        if (!p) throw std::runtime_error("expected array");
        return *p;
    }
    std::string string() const {
        const auto* p = std::get_if<std::string>(&value);
        if (!p) throw std::runtime_error("expected string");
        return *p;
    }
    bool boolean() const {
        const auto* p = std::get_if<bool>(&value);
        if (!p) throw std::runtime_error("expected boolean");
        return *p;
    }
    double number() const {
        const auto* p = std::get_if<double>(&value);
        if (p && std::isfinite(*p)) return *p;
        if (const auto* u = std::get_if<std::uint64_t>(&value)) return static_cast<double>(*u);
        throw std::runtime_error("expected finite number");
    }
};

class JsonParser {
public:
    explicit JsonParser(const std::string& s) : s_(s) {}
    Json parse() { auto v = value(); ws(); if (i_ != s_.size()) fail(); return v; }
private:
    const std::string& s_; std::size_t i_{0}; std::size_t depth_{0};
    [[noreturn]] void fail() const { throw std::runtime_error("invalid JSON"); }
    void ws() { while (i_ < s_.size() && (s_[i_]==' '||s_[i_]=='\n'||s_[i_]=='\r'||s_[i_]=='\t')) ++i_; }
    bool take(char c) { ws(); if (i_ < s_.size() && s_[i_]==c) { ++i_; return true; } return false; }
    Json value() {
        ws(); if (i_ >= s_.size()) fail();
        if (s_[i_]=='{') return object();
        if (s_[i_]=='[') return array();
        if (s_[i_]=='"') return Json{string()};
        if (s_.compare(i_,4,"true")==0) { i_+=4; return Json{true}; }
        if (s_.compare(i_,5,"false")==0) { i_+=5; return Json{false}; }
        if (s_.compare(i_,4,"null")==0) { i_+=4; return Json{nullptr}; }
        const auto start=i_; if (s_[i_]=='-') ++i_;
        if(i_>=s_.size()) fail();
        if(s_[i_]=='0') { ++i_; if(i_<s_.size()&&s_[i_]>='0'&&s_[i_]<='9') fail(); }
        else { if(s_[i_]<'1'||s_[i_]>'9') fail(); while(i_<s_.size()&&s_[i_]>='0'&&s_[i_]<='9') ++i_; }
        if(i_<s_.size()&&s_[i_]=='.') { ++i_; const auto digits=i_; while(i_<s_.size()&&s_[i_]>='0'&&s_[i_]<='9') ++i_; if(i_==digits) fail(); }
        if(i_<s_.size()&&(s_[i_]=='e'||s_[i_]=='E')) { ++i_; if(i_<s_.size()&&(s_[i_]=='+'||s_[i_]=='-')) ++i_; const auto digits=i_; while(i_<s_.size()&&s_[i_]>='0'&&s_[i_]<='9') ++i_; if(i_==digits) fail(); }
        try {
            const auto token=s_.substr(start,i_-start);
            if(token.find_first_of(".eE")==std::string::npos && token.front()!='-') {
                std::size_t n=0; const auto u=std::stoull(token,&n); if(n!=token.size()) fail(); return Json{static_cast<std::uint64_t>(u)};
            }
            std::size_t n=0; const double d=std::stod(token,&n); if(n!=token.size()||!std::isfinite(d)) fail(); return Json{d};
        } catch(...) { fail(); }
    }
    std::string string() {
        if (!take('"')) fail();
        std::string out;
        while(i_<s_.size()) {
            char c=s_[i_++]; if(c=='"') return out;
            if(c=='\\') {
                if(i_>=s_.size()) fail();
                char e=s_[i_++];
                switch(e) {
                    case '"': case '\\': case '/': out+=e; break;
                    case 'b': out+='\b'; break; case 'f': out+='\f'; break;
                    case 'n': out+='\n'; break; case 'r': out+='\r'; break; case 't': out+='\t'; break;
                    case 'u': {
                        auto hex_unit=[&]() -> std::uint32_t {
                            if(i_+4>s_.size()) fail();
                            std::uint32_t n=0;
                            for(int j=0;j<4;++j) { const char h=s_[i_++]; n<<=4;
                                if(h>='0'&&h<='9') n+=h-'0'; else if(h>='a'&&h<='f') n+=h-'a'+10;
                                else if(h>='A'&&h<='F') n+=h-'A'+10; else fail(); }
                            return n;
                        };
                        std::uint32_t cp=hex_unit();
                        if(cp>=0xd800&&cp<=0xdbff) {
                            if(i_+2>s_.size()||s_[i_]!='\\'||s_[i_+1]!='u') fail();
                            i_+=2;
                            const auto low=hex_unit(); if(low<0xdc00||low>0xdfff) fail(); cp=0x10000+((cp-0xd800)<<10)+(low-0xdc00);
                        } else if(cp>=0xdc00&&cp<=0xdfff) fail();
                        if(cp<=0x7f) out+=static_cast<char>(cp);
                        else if(cp<=0x7ff) { out+=static_cast<char>(0xc0|(cp>>6)); out+=static_cast<char>(0x80|(cp&0x3f)); }
                        else if(cp<=0xffff) { out+=static_cast<char>(0xe0|(cp>>12)); out+=static_cast<char>(0x80|((cp>>6)&0x3f)); out+=static_cast<char>(0x80|(cp&0x3f)); }
                        else { out+=static_cast<char>(0xf0|(cp>>18)); out+=static_cast<char>(0x80|((cp>>12)&0x3f)); out+=static_cast<char>(0x80|((cp>>6)&0x3f)); out+=static_cast<char>(0x80|(cp&0x3f)); }
                        break;
                    }
                    default: fail();
                }
            } else { if(static_cast<unsigned char>(c)<0x20) fail(); out+=c; }
        }
        fail();
    }
    Json object() { if(++depth_>32) fail(); take('{'); Json::Object o; if(take('}')) { --depth_; return Json{o}; } do { ws(); if(i_>=s_.size()||s_[i_]!='"') fail(); auto k=string(); if(!take(':')) fail(); if(!o.emplace(k,value()).second) fail(); } while(take(',')); if(!take('}')) fail(); --depth_; return Json{o}; }
    Json array() { if(++depth_>32) fail(); take('['); Json::Array a; if(take(']')) { --depth_; return Json{a}; } do { a.push_back(value()); } while(take(',')); if(!take(']')) fail(); --depth_; return Json{a}; }
};

void require_utf8(const std::string& text) {
    for(std::size_t i=0;i<text.size();) {
        const auto c=static_cast<unsigned char>(text[i]);
        if(c<=0x7f) { ++i; continue; }
        std::size_t count=0; unsigned char second_min=0x80, second_max=0xbf;
        if(c>=0xc2&&c<=0xdf) count=2;
        else if(c>=0xe0&&c<=0xef) { count=3; if(c==0xe0) second_min=0xa0; if(c==0xed) second_max=0x9f; }
        else if(c>=0xf0&&c<=0xf4) { count=4; if(c==0xf0) second_min=0x90; if(c==0xf4) second_max=0x8f; }
        else throw std::runtime_error("invalid UTF-8");
        if(i+count>text.size()) throw std::runtime_error("truncated UTF-8");
        const auto second=static_cast<unsigned char>(text[i+1]);
        if(second<second_min||second>second_max) throw std::runtime_error("invalid UTF-8");
        for(std::size_t j=2;j<count;++j) { const auto continuation=static_cast<unsigned char>(text[i+j]); if(continuation<0x80||continuation>0xbf) throw std::runtime_error("invalid UTF-8"); }
        i+=count;
    }
}

std::uint64_t uint_field(const Json& j, const std::string& key) {
    if (const auto* u=std::get_if<std::uint64_t>(&j.at(key).value)) return *u;
    const double n=j.at(key).number();
    if(n<0 || n>9007199254740991.0 || std::floor(n)!=n) throw std::runtime_error("invalid unsigned field: "+key);
    return static_cast<std::uint64_t>(n);
}
bool nullable_number(const Json& j, double& out) {
    if(std::holds_alternative<std::nullptr_t>(j.value)) return false;
    out=j.number(); return true;
}
std::optional<double> optional_number(const Json& j) {
    if(std::holds_alternative<std::nullptr_t>(j.value)) return std::nullopt;
    return j.number();
}
std::optional<std::int64_t> optional_integer(const Json& j) {
    if(std::holds_alternative<std::nullptr_t>(j.value)) return std::nullopt;
    if(const auto* u=std::get_if<std::uint64_t>(&j.value)) {
        if(*u>static_cast<std::uint64_t>(std::numeric_limits<std::int64_t>::max())) throw std::runtime_error("sample integer out of range");
        return static_cast<std::int64_t>(*u);
    }
    const double n=j.number();
    if(std::floor(n)!=n||n<-9007199254740991.0||n>9007199254740991.0) throw std::runtime_error("invalid sample integer");
    return static_cast<std::int64_t>(n);
}
RunnerScene parse_scene(const std::string& packet, const std::string& session, std::uint64_t previous) {
    require_utf8(packet);
    const Json root=JsonParser(packet).parse();
    if(uint_field(root,"protocol_version")!=1 || root.at("type").string()!="scene") throw std::runtime_error("unsupported message");
    RunnerScene result;
    result.session=root.at("runner_session").string();
    if(result.session!=session) throw std::runtime_error("session mismatch");
    result.sequence=uint_field(root,"sequence"); if(result.sequence<=previous) throw std::runtime_error("out of order sequence");
    result.captured_monotonic_ns=uint_field(root,"captured_monotonic_ns");
    const auto& quality=root.at("quality");
    result.ego_valid=quality.at("ego_valid").boolean(); result.objects_valid=quality.at("objects_valid").boolean();
    result.objects_degraded=quality.at("objects_degraded").boolean(); result.objects_truncated=quality.at("objects_truncated").boolean();
    if(result.objects_truncated && !result.objects_degraded) throw std::runtime_error("truncated scans must be degraded");
    const auto& ego=root.at("ego"); result.has_steering=nullable_number(ego.at("steering_deg"),result.steering_deg);
    result.has_speed=nullable_number(ego.at("longitudinal_speed_mps"),result.longitudinal_speed_mps);
    if(result.has_steering && std::abs(result.steering_deg)>90.0) throw std::runtime_error("steering out of range");
    if(result.has_speed && std::abs(result.longitudinal_speed_mps)>150.0) throw std::runtime_error("speed out of range");
    const auto& sample=root.at("sample");
    result.source=sample.at("source").string();
    if(result.source.empty()||result.source.size()>32) throw std::runtime_error("invalid sample source");
    result.seed=optional_integer(sample.at("seed")); result.episode_step=optional_integer(sample.at("episode_step"));
    if(result.episode_step&&*result.episode_step<0) throw std::runtime_error("invalid episode step");
    result.sim_time_s=optional_number(sample.at("sim_time_s"));
    const auto& objects=root.at("objects").array(); if(objects.size()>kMaxObjects) throw std::runtime_error("too many objects");
    for(const auto& item:objects) {
        RunnerObject o; o.id=item.at("id").string(); o.type=item.at("type").string();
        if(o.id.empty()||o.id.size()>64||o.type.size()>32) throw std::runtime_error("invalid object identity");
        o.x_forward_m=item.at("x_forward_m").number(); o.y_left_m=item.at("y_left_m").number();
        o.length_m=optional_number(item.at("length_m")); o.width_m=optional_number(item.at("width_m"));
        o.relative_heading_rad=optional_number(item.at("relative_heading_rad"));
        if(std::abs(o.x_forward_m)>100000.0||std::abs(o.y_left_m)>100000.0||
           (o.length_m&&(*o.length_m<0||*o.length_m>100.0))||
           (o.width_m&&(*o.width_m<0||*o.width_m>100.0))||
           (o.relative_heading_rad&&std::abs(*o.relative_heading_rad)>6.3)) throw std::runtime_error("object geometry out of range");
        result.objects.push_back(std::move(o));
    }
    return result;
}
std::string handshake_session(const std::string& packet) {
    require_utf8(packet);
    const auto j=JsonParser(packet).parse();
    if(uint_field(j,"protocol_version")!=1 || j.at("type").string()!="hello" || j.at("role").string()!="runner") throw std::runtime_error("unsupported hello");
    auto session=j.at("runner_session").string();
    if(session.size()!=36) throw std::runtime_error("invalid session");
    for(std::size_t i=0;i<session.size();++i) {
        if(i==8||i==13||i==18||i==23) { if(session[i]!='-') throw std::runtime_error("invalid session"); }
        else if(!((session[i]>='0'&&session[i]<='9')||(session[i]>='a'&&session[i]<='f'))) throw std::runtime_error("invalid session");
    }
    return session;
}
}  // namespace

RunnerIpcServer::RunnerIpcServer(std::string path) : path_(std::move(path)) {
    if(path_.empty() || path_[0]!='/' || path_.size()>=sizeof(sockaddr_un::sun_path)) throw std::invalid_argument("socket path must be absolute and fit sun_path");
}
RunnerIpcServer::~RunnerIpcServer() { stop(); const int fd=listen_fd_.exchange(-1); if(fd>=0) ::close(fd); }
std::string RunnerIpcServer::socket_path() const { return path_; }
bool RunnerIpcServer::has_scene() const { std::lock_guard<std::mutex> lock(state_lock_); return has_scene_; }
RunnerScene RunnerIpcServer::latest_scene() const { std::lock_guard<std::mutex> lock(state_lock_); return scene_; }
void RunnerIpcServer::stop() { stopping_.store(true); const int fd=listen_fd_.load(); if(fd>=0) ::shutdown(fd,SHUT_RDWR); }
void RunnerIpcServer::run() {
    struct sigaction action{}; action.sa_handler=request_shutdown; sigemptyset(&action.sa_mask); action.sa_flags=0;
    ::sigaction(SIGINT,&action,nullptr); ::sigaction(SIGTERM,&action,nullptr);
    shutdown_requested=0;
    const auto slash=path_.find_last_of('/'); const std::string dir=slash==0?"/":path_.substr(0,slash);
    struct stat st{};
    if(::lstat(dir.c_str(),&st)!=0 && errno==ENOENT) {
        const auto parent_slash=dir.find_last_of('/');
        const std::string parent=parent_slash==0?"/":dir.substr(0,parent_slash);
        struct stat parent_st{};
        if(::lstat(parent.c_str(),&parent_st)!=0 || !S_ISDIR(parent_st.st_mode))
            throw std::runtime_error("socket parent directory must exist and be a directory");
        const bool owned_parent=parent_st.st_uid==::getuid();
        const bool safe_tmp=parent=="/tmp" && (parent_st.st_mode&S_ISVTX) && (parent_st.st_mode&S_IWOTH);
        if(!owned_parent && !safe_tmp) throw std::runtime_error("cannot create socket directory under an untrusted parent");
        if(::mkdir(dir.c_str(),0700)!=0 && errno!=EEXIST) throw std::runtime_error("cannot create socket directory");
    }
    if(::lstat(dir.c_str(),&st)!=0 || !S_ISDIR(st.st_mode) || st.st_uid!=::getuid()) throw std::runtime_error("socket directory must exist and belong to this user");
    if((st.st_mode&0777)!=0700) throw std::runtime_error("socket directory must have mode 0700");
    struct stat existing{};
    if(::lstat(path_.c_str(),&existing)==0) {
        if(!S_ISSOCK(existing.st_mode) || existing.st_uid!=::getuid()) throw std::runtime_error("refusing to replace a non-owned socket path");
        const int probe=::socket(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,0);
        sockaddr_un probe_addr{}; probe_addr.sun_family=AF_UNIX; std::strncpy(probe_addr.sun_path,path_.c_str(),sizeof(probe_addr.sun_path)-1);
        const bool active=probe>=0 && ::connect(probe,reinterpret_cast<sockaddr*>(&probe_addr),sizeof(probe_addr))==0;
        if(probe>=0) ::close(probe);
        if(active) throw std::runtime_error("runner IPC socket is already active");
        if(errno!=ECONNREFUSED && errno!=ENOENT) throw std::runtime_error("cannot determine whether socket is stale");
        ::unlink(path_.c_str());
    } else if(errno!=ENOENT) throw std::runtime_error("cannot inspect socket path");
    listen_fd_=::socket(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,0); if(listen_fd_<0) throw std::runtime_error("socket failed");
    sockaddr_un addr{}; addr.sun_family=AF_UNIX; std::strncpy(addr.sun_path,path_.c_str(),sizeof(addr.sun_path)-1);
    if(::bind(listen_fd_,reinterpret_cast<sockaddr*>(&addr),sizeof(addr))<0) throw std::runtime_error("bind failed: "+std::string(std::strerror(errno)));
    ::chmod(path_.c_str(),0600); if(::listen(listen_fd_,4)<0) throw std::runtime_error("listen failed");
    while(!stopping_.load()&&!shutdown_requested) {
        pollfd listener{listen_fd_.load(),POLLIN,0};
        const int listener_ready=::poll(&listener,1,250);
        if(listener_ready<0) { if(errno==EINTR) continue; if(stopping_.load()||shutdown_requested) break; continue; }
        if(listener_ready==0) continue;
        if(stopping_.load()||shutdown_requested) break;
        if(listener.revents&(POLLERR|POLLHUP|POLLNVAL)) break;
        if(!(listener.revents&POLLIN)) continue;
        int client=::accept4(listen_fd_.load(),nullptr,nullptr,SOCK_CLOEXEC); if(client<0) { if(stopping_.load()||shutdown_requested) break; if(errno==EINTR) continue; continue; }
        ucred cred{}; socklen_t cred_len=sizeof(cred);
        if(::getsockopt(client,SOL_SOCKET,SO_PEERCRED,&cred,&cred_len)<0||cred.uid!=::getuid()) { ::close(client); continue; }
        timeval handshake_timeout{2,0}; ::setsockopt(client,SOL_SOCKET,SO_RCVTIMEO,&handshake_timeout,sizeof(handshake_timeout));
        char buffer[kMaxPacket+1];
        auto recv_packet=[&]() -> ssize_t { iovec iov{buffer,kMaxPacket}; msghdr msg{}; msg.msg_iov=&iov; msg.msg_iovlen=1; const auto n=::recvmsg(client,&msg,0); if(n>=0&&(msg.msg_flags&MSG_TRUNC)) return -2; return n; };
        try {
            auto n=recv_packet(); if(n<=0) throw std::runtime_error("missing hello");
            const std::string session=handshake_session(std::string(buffer,static_cast<std::size_t>(n)));
            const std::string reply="{\"protocol_version\":1,\"type\":\"hello_ack\",\"runner_session\":\""+session+"\"}";
            if(::send(client,reply.data(),reply.size(),MSG_NOSIGNAL)<0) throw std::runtime_error("hello reply failed");
            std::cout << "runner connected session=" << session << std::endl;
            std::uint64_t sequence=0; RunnerScene empty; { std::lock_guard<std::mutex> lock(state_lock_); scene_=empty; has_scene_=false; }
            while(!stopping_.load()&&!shutdown_requested) {
                pollfd events[2]{{client,POLLIN,0},{listen_fd_.load(),POLLIN,0}};
                const int ready=::poll(events,2,250);
                if(ready<0) { if(errno==EINTR) continue; break; }
                if(ready==0) continue;
                if(events[1].revents&POLLIN) {
                    const int second=::accept4(listen_fd_.load(),nullptr,nullptr,SOCK_CLOEXEC);
                    if(second>=0) {
                        ucred second_cred{}; socklen_t second_cred_len=sizeof(second_cred);
                        if(::getsockopt(second,SOL_SOCKET,SO_PEERCRED,&second_cred,&second_cred_len)==0 && second_cred.uid==::getuid()) {
                            timeval competing_timeout{0,100000};
                            ::setsockopt(second,SOL_SOCKET,SO_RCVTIMEO,&competing_timeout,sizeof(competing_timeout));
                            char competing_buffer[kMaxPacket];
                            const auto received=::recv(second,competing_buffer,sizeof(competing_buffer),0);
                            if(received>0) {
                                const std::string reject="{\"protocol_version\":1,\"type\":\"hello_reject\",\"reason\":\"publisher_active\"}";
                                const auto sent=::send(second,reject.data(),reject.size(),MSG_NOSIGNAL);
                                if(sent<0 || static_cast<std::size_t>(sent)!=reject.size())
                                    std::cerr << "runner IPC could not reject competing publisher: " << std::strerror(errno) << std::endl;
                            }
                        }
                        ::close(second);
                    }
                }
                if(!(events[0].revents&POLLIN)) {
                    if(events[0].revents&(POLLERR|POLLHUP|POLLNVAL)) break;
                    continue;
                }
                n=recv_packet();
                if(n==-2) { std::cerr << "runner scene rejected: packet exceeds 64 KiB" << std::endl; continue; }
                if(n<=0) { if(n<0&&errno==EINTR&&shutdown_requested) break; break; }
                try {
                    const std::string payload(buffer,static_cast<std::size_t>(n));
                    auto next=parse_scene(payload,session,sequence);
                    const auto now=std::chrono::steady_clock::now().time_since_epoch();
                    const auto now_ns=std::chrono::duration_cast<std::chrono::nanoseconds>(now).count();
                    const auto source_ns=next.captured_monotonic_ns;
                    if(source_ns>static_cast<std::uint64_t>(now_ns)+10000000ULL ||
                       (source_ns<=static_cast<std::uint64_t>(now_ns) && static_cast<std::uint64_t>(now_ns)-source_ns>250000000ULL)) continue;
                    sequence=next.sequence;
                    {
                        std::lock_guard<std::mutex> lock(state_lock_);
                        scene_=std::move(next);
                        has_scene_=true;
                    }
                    std::cout << "runner scene received seq=" << sequence << " json=" << payload << std::endl;
                } catch(const std::exception& error) {
                    std::cerr << "runner scene rejected: " << error.what() << std::endl;
                }
            }
        } catch(const std::exception& error) {
            std::cerr << "runner handshake rejected: " << error.what() << std::endl;
            const std::string reject="{\"protocol_version\":1,\"type\":\"hello_reject\",\"reason\":\"unsupported_or_malformed\"}";
            ::send(client,reject.data(),reject.size(),MSG_NOSIGNAL);
        }
        ::close(client);
        { std::lock_guard<std::mutex> lock(state_lock_); has_scene_=false; }
    }
    const int listening_fd=listen_fd_.exchange(-1); if(listening_fd>=0) ::close(listening_fd);
    ::unlink(path_.c_str());
}
}  // namespace afs_bridge
