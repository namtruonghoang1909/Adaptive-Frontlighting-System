#include "afs_bridge/runner_ipc.hpp"
#include "afs_bridge/dashboard_ipc.hpp"

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
#include <sstream>
#include <iomanip>
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
constexpr std::size_t kMaxDashboardObjects = 24;
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
    const Json* find(const std::string& key) const {
        const auto* object = std::get_if<Object>(&value);
        if (!object) throw std::runtime_error("expected object");
        const auto it = object->find(key);
        return it == object->end() ? nullptr : &it->second;
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
    result.max_steering_deg=optional_number(ego.at("max_steering_deg"));
    result.has_speed=nullable_number(ego.at("longitudinal_speed_mps"),result.longitudinal_speed_mps);
    const auto* position_x = ego.find("position_x_m");
    const auto* position_y = ego.find("position_y_m");
    if ((position_x == nullptr) != (position_y == nullptr))
        throw std::runtime_error("incomplete ego position");
    if (position_x) {
        const bool has_x = nullable_number(*position_x, result.position_x_m);
        const bool has_y = nullable_number(*position_y, result.position_y_m);
        if (has_x != has_y) throw std::runtime_error("incomplete ego position");
        result.has_position = has_x;
    }
    if (const auto* heading = ego.find("heading_deg"))
        result.has_heading = nullable_number(*heading, result.heading_deg);
    if(result.max_steering_deg && *result.max_steering_deg<=0.0) throw std::runtime_error("maximum steering angle must be positive");
    if(result.has_steering && result.max_steering_deg &&
       std::abs(result.steering_deg)>*result.max_steering_deg) throw std::runtime_error("steering out of range");
    if(result.has_speed && std::abs(result.longitudinal_speed_mps)>150.0) throw std::runtime_error("speed out of range");
    if(result.has_position && (std::abs(result.position_x_m)>1000000.0 ||
                               std::abs(result.position_y_m)>1000000.0))
        throw std::runtime_error("ego position out of range");
    if(result.has_heading && std::abs(result.heading_deg)>360.0)
        throw std::runtime_error("ego heading out of range");
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
    result.ipc_faulted=false;
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

bool valid_dashboard_id(const std::string& id) {
    if (id.empty() || id.size() > 64) return false;
    return std::all_of(id.begin(), id.end(), [](char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
               (c >= '0' && c <= '9') || c == '-' || c == '_';
    });
}

bool valid_mode(const std::string& mode) {
    return mode == "low_beam_no_swivel" || mode == "low_beam_swivel" ||
           mode == "high_beam_no_dimming" || mode == "high_beam_dimming";
}

std::uint8_t mode_code(const std::string& mode) {
    if (mode == "low_beam_no_swivel") return 0;
    if (mode == "low_beam_swivel") return 1;
    if (mode == "high_beam_no_dimming") return 2;
    if (mode == "high_beam_dimming") return 3;
    throw std::invalid_argument("unsupported headlight mode");
}

bool send_dashboard_packet(int fd, const std::string& packet) {
    const auto sent = ::send(fd, packet.data(), packet.size(), MSG_NOSIGNAL);
    return sent >= 0 && static_cast<std::size_t>(sent) == packet.size();
}

std::string dashboard_status(const RunnerIpcServer& runner,
                             const DashboardIpcServer& dashboard) {
    const auto request = dashboard.command_snapshot();
    const auto ecu = dashboard.latest_ecu_status();
    const auto current = runner.current_scene();
    const bool connected = current.has_value();
    const RunnerScene scene = current.value_or(RunnerScene{});
    const auto now = std::chrono::steady_clock::now().time_since_epoch();
    const auto now_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(now).count();
    const auto source_ns = scene.captured_monotonic_ns;
    const bool timestamp_valid = connected && source_ns <= static_cast<std::uint64_t>(now_ns) + 10000000ULL;
    const auto age_ns = timestamp_valid && source_ns <= static_cast<std::uint64_t>(now_ns)
                            ? static_cast<std::uint64_t>(now_ns) - source_ns : 0ULL;
    const bool fresh = timestamp_valid && !scene.ipc_faulted &&
                       source_ns <= static_cast<std::uint64_t>(now_ns) && age_ns <= 250000000ULL;
    std::ostringstream out;
    out << std::setprecision(12) << "{\"protocol_version\":1,\"type\":\"status\",\"runner\":{"
        << "\"connected\":" << (connected ? "true" : "false")
        << ",\"fresh\":" << (fresh ? "true" : "false")
        << ",\"age_ms\":";
    if (timestamp_valid && source_ns <= static_cast<std::uint64_t>(now_ns)) out << age_ns / 1000000ULL;
    else out << "null";
    out << ",\"speed_kmh\":";
    if (fresh && scene.ego_valid && scene.has_speed) out << scene.longitudinal_speed_mps * 3.6;
    else out << "null";
    out << ",\"steering_deg\":";
    if (fresh && scene.ego_valid && scene.has_steering) out << scene.steering_deg;
    else out << "null";
    out << ",\"position_x_m\":";
    if (fresh && scene.ego_valid && scene.has_position) out << scene.position_x_m;
    else out << "null";
    out << ",\"position_y_m\":";
    if (fresh && scene.ego_valid && scene.has_position) out << scene.position_y_m;
    else out << "null";
    out << ",\"heading_deg\":";
    if (fresh && scene.ego_valid && scene.has_heading) out << scene.heading_deg;
    else out << "null";
    const bool objects_valid = fresh && scene.objects_valid && !scene.objects_degraded;
    std::vector<const RunnerObject*> display_objects;
    if (objects_valid) {
        for (const auto& object : scene.objects) {
            if (object.type == "VEHICLE" && object.x_forward_m >= 0.0 &&
                object.x_forward_m <= 100.0 && std::abs(object.y_left_m) <= 12.0)
                display_objects.push_back(&object);
        }
        std::sort(display_objects.begin(), display_objects.end(), [](const auto* left, const auto* right) {
            return std::hypot(left->x_forward_m, left->y_left_m) <
                   std::hypot(right->x_forward_m, right->y_left_m);
        });
    }
    out << ",\"objects_valid\":" << (objects_valid ? "true" : "false")
        << ",\"objects_limited\":" << (display_objects.size() > kMaxDashboardObjects ? "true" : "false")
        << ",\"objects\":[";
    for (std::size_t index = 0; index < std::min(display_objects.size(), kMaxDashboardObjects); ++index) {
        if (index) out << ',';
        out << "{\"x_forward_m\":" << display_objects[index]->x_forward_m
            << ",\"y_left_m\":" << display_objects[index]->y_left_m << '}';
    }
    out << "]},\"request\":{\"present\":" << (request.present ? "true" : "false")
        << ",\"valid\":" << (request.valid ? "true" : "false")
        << ",\"request_id\":";
    if (request.present) out << '"' << request.request_id << '"';
    else out << "null";
    out
        << ",\"power_on\":" << (request.power_on ? "true" : "false")
        << ",\"mode\":\"" << request.mode << "\"},\"can\":{\"enabled\":"
        << (dashboard.can_enabled() ? "true" : "false")
        << "},\"ecu\":{\"available\":" << (ecu ? "true" : "false");
    if (ecu) {
        const auto now = std::chrono::steady_clock::now().time_since_epoch();
        const auto now_ns = static_cast<std::uint64_t>(
            std::chrono::duration_cast<std::chrono::nanoseconds>(now).count());
        const bool timestamp_valid = ecu->received_monotonic_ns <= now_ns;
        const auto age_ns = timestamp_valid ? now_ns - ecu->received_monotonic_ns : 0;
        const bool fresh = timestamp_valid && age_ns <= 250'000'000ULL;
        out << ",\"fresh\":" << (fresh ? "true" : "false")
            << ",\"age_ms\":";
        if (timestamp_valid) out << age_ns / 1'000'000ULL;
        else out << "null";
        out << ",\"alive_counter\":" << static_cast<unsigned int>(ecu->alive_counter)
            << ",\"required_inputs_valid\":" << (ecu->required_inputs_valid ? "true" : "false")
            << ",\"fault_present\":" << (ecu->fault_present ? "true" : "false")
            << ",\"safe_fallback\":" << (ecu->safe_fallback ? "true" : "false")
            << ",\"executed_mode\":" << static_cast<unsigned int>(ecu->executed_mode)
            << ",\"health_state\":" << static_cast<unsigned int>(ecu->health_state)
            << ",\"steering_stale\":" << (ecu->steering_stale ? "true" : "false")
            << ",\"speed_stale\":" << (ecu->speed_stale ? "true" : "false")
            << ",\"object_stale\":" << (ecu->object_stale ? "true" : "false")
            << ",\"dashboard_stale\":" << (ecu->dashboard_stale ? "true" : "false")
            << ",\"servo_control_lost\":" << (ecu->servo_control_lost ? "true" : "false")
            << ",\"servo_mismatch\":" << (ecu->servo_mismatch ? "true" : "false")
            << ",\"beam_control_lost\":" << (ecu->beam_control_lost ? "true" : "false")
            << ",\"can_decode_fault\":" << (ecu->can_decode_fault ? "true" : "false")
            << ",\"left_servo_feedback_deg\":" << ecu->left_servo_feedback_deg
            << ",\"right_servo_feedback_deg\":" << ecu->right_servo_feedback_deg
            << ",\"applied_dim_sector_mask\":" << ecu->applied_dim_sector_mask;
    } else {
        out << ",\"fresh\":false,\"age_ms\":null";
    }
    out << "}}";
    return out.str();
}
}  // namespace

RunnerIpcServer::RunnerIpcServer(std::string path, bool log_scenes)
    : path_(std::move(path)), log_scenes_(log_scenes) {
    if(path_.empty() || path_[0]!='/' || path_.size()>=sizeof(sockaddr_un::sun_path)) throw std::invalid_argument("socket path must be absolute and fit sun_path");
}
RunnerIpcServer::~RunnerIpcServer() { stop(); const int fd=listen_fd_.exchange(-1); if(fd>=0) ::close(fd); }
std::string RunnerIpcServer::socket_path() const { return path_; }
bool RunnerIpcServer::has_scene() const { std::lock_guard<std::mutex> lock(state_lock_); return has_scene_; }
RunnerScene RunnerIpcServer::latest_scene() const { std::lock_guard<std::mutex> lock(state_lock_); return scene_; }
std::optional<RunnerScene> RunnerIpcServer::current_scene() const {
    std::lock_guard<std::mutex> lock(state_lock_);
    return has_scene_ ? std::optional<RunnerScene>(scene_) : std::nullopt;
}
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
            auto mark_ipc_fault=[&] { std::lock_guard<std::mutex> lock(state_lock_); scene_.ipc_faulted=true; };
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
                if(n==-2) { mark_ipc_fault(); std::cerr << "runner scene rejected: packet exceeds 64 KiB" << std::endl; continue; }
                if(n<=0) { if(n<0&&errno==EINTR&&shutdown_requested) break; break; }
                try {
                    const std::string payload(buffer,static_cast<std::size_t>(n));
                    auto next=parse_scene(payload,session,sequence);
                    const auto now=std::chrono::steady_clock::now().time_since_epoch();
                    const auto now_ns=std::chrono::duration_cast<std::chrono::nanoseconds>(now).count();
                    const auto source_ns=next.captured_monotonic_ns;
                    if(source_ns>static_cast<std::uint64_t>(now_ns)+10000000ULL ||
                       (source_ns<=static_cast<std::uint64_t>(now_ns) && static_cast<std::uint64_t>(now_ns)-source_ns>250000000ULL)) {
                        mark_ipc_fault();
                        std::cerr << "runner scene rejected: source timestamp outside freshness window" << std::endl;
                        continue;
                    }
                    sequence=next.sequence;
                    {
                        std::lock_guard<std::mutex> lock(state_lock_);
                        scene_=std::move(next);
                        has_scene_=true;
                    }
                    if (log_scenes_) {
                        std::cout << "runner scene received seq=" << sequence
                                  << " json=" << payload << std::endl;
                    }
                } catch(const std::exception& error) {
                    mark_ipc_fault();
                    std::cerr << "runner scene rejected: " << error.what() << std::endl;
                }
            }
        } catch(const std::exception& error) {
            std::cerr << "runner handshake rejected: " << error.what() << std::endl;
            const std::string reject="{\"protocol_version\":1,\"type\":\"hello_reject\",\"reason\":\"unsupported_or_malformed\"}";
            ::send(client,reject.data(),reject.size(),MSG_NOSIGNAL);
        }
        ::close(client);
        { std::lock_guard<std::mutex> lock(state_lock_); has_scene_=false; scene_.ipc_faulted=true; }
    }
    const int listening_fd=listen_fd_.exchange(-1); if(listening_fd>=0) ::close(listening_fd);
    ::unlink(path_.c_str());
}

DashboardIpcServer::DashboardIpcServer(std::string socket_path,
                                       const RunnerIpcServer& runner,
                                       bool can_enabled)
    : path_(std::move(socket_path)), runner_(runner), can_enabled_(can_enabled) {
    if (path_.empty() || path_[0] != '/' || path_.size() >= sizeof(sockaddr_un::sun_path))
        throw std::invalid_argument("dashboard socket path must be absolute and fit sun_path");
}

DashboardIpcServer::~DashboardIpcServer() {
    stop();
    const int client = client_fd_.exchange(-1);
    if (client >= 0) ::close(client);
    const int listener = listen_fd_.exchange(-1);
    if (listener >= 0) ::close(listener);
}

std::string DashboardIpcServer::socket_path() const { return path_; }

bool DashboardIpcServer::can_enabled() const { return can_enabled_; }

DashboardCommandSnapshot DashboardIpcServer::command_snapshot() const {
    std::lock_guard<std::mutex> lock(state_lock_);
    return {has_request_, dashboard_connected_ && (has_request_ || clear_fault_pending_), request_id_,
            power_on_, mode_, mode_code_, clear_fault_pending_,
            clear_fault_generation_};
}

std::optional<AfsStatus> DashboardIpcServer::latest_ecu_status() const {
    std::lock_guard<std::mutex> lock(state_lock_);
    return latest_ecu_status_;
}

void DashboardIpcServer::retain_ecu_status(const AfsStatus& status) {
    std::lock_guard<std::mutex> lock(state_lock_);
    latest_ecu_status_ = status;
}

void DashboardIpcServer::acknowledge_clear_fault(std::uint64_t generation) {
    std::lock_guard<std::mutex> lock(state_lock_);
    if (clear_fault_pending_ && generation == clear_fault_generation_) {
        clear_fault_pending_ = false;
    }
}

void DashboardIpcServer::stop() {
    stopping_.store(true);
    const int client = client_fd_.load();
    if (client >= 0) ::shutdown(client, SHUT_RDWR);
    const int listener = listen_fd_.load();
    if (listener >= 0) ::shutdown(listener, SHUT_RDWR);
}

void DashboardIpcServer::run() {
    const auto slash = path_.find_last_of('/');
    const std::string dir = slash == 0 ? "/" : path_.substr(0, slash);
    struct stat st{};
    if (::lstat(dir.c_str(), &st) != 0 && errno == ENOENT) {
        const auto parent_slash = dir.find_last_of('/');
        const std::string parent = parent_slash == 0 ? "/" : dir.substr(0, parent_slash);
        struct stat parent_st{};
        if (::lstat(parent.c_str(), &parent_st) != 0 || !S_ISDIR(parent_st.st_mode))
            throw std::runtime_error("dashboard socket parent must be a directory");
        const bool safe_tmp = parent == "/tmp" && (parent_st.st_mode & S_ISVTX) && (parent_st.st_mode & S_IWOTH);
        if (parent_st.st_uid != ::getuid() && !safe_tmp)
            throw std::runtime_error("untrusted dashboard socket parent");
        if (::mkdir(dir.c_str(), 0700) != 0 && errno != EEXIST)
            throw std::runtime_error("cannot create dashboard socket directory");
    }
    if (::lstat(dir.c_str(), &st) != 0 || !S_ISDIR(st.st_mode) ||
        st.st_uid != ::getuid() || (st.st_mode & 0777) != 0700)
        throw std::runtime_error("dashboard socket directory must be private and owned by this user");
    struct stat existing{};
    if (::lstat(path_.c_str(), &existing) == 0) {
        if (!S_ISSOCK(existing.st_mode) || existing.st_uid != ::getuid())
            throw std::runtime_error("refusing to replace dashboard socket path");
        const int probe = ::socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
        sockaddr_un probe_addr{}; probe_addr.sun_family = AF_UNIX;
        std::strncpy(probe_addr.sun_path, path_.c_str(), sizeof(probe_addr.sun_path) - 1);
        const bool active = probe >= 0 && ::connect(probe, reinterpret_cast<sockaddr*>(&probe_addr), sizeof(probe_addr)) == 0;
        const int connect_error = errno;
        if (probe >= 0) ::close(probe);
        if (active) throw std::runtime_error("dashboard IPC socket is already active");
        if (connect_error != ECONNREFUSED && connect_error != ENOENT)
            throw std::runtime_error("cannot determine whether dashboard socket is stale");
        if (::unlink(path_.c_str()) != 0) throw std::runtime_error("cannot remove stale dashboard socket");
    } else if (errno != ENOENT) throw std::runtime_error("cannot inspect dashboard socket path");
    const int listener = ::socket(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0);
    if (listener < 0) throw std::runtime_error("dashboard socket creation failed");
    listen_fd_ = listener;
    sockaddr_un addr{}; addr.sun_family = AF_UNIX;
    std::strncpy(addr.sun_path, path_.c_str(), sizeof(addr.sun_path) - 1);
    if (::bind(listener, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0)
        throw std::runtime_error("dashboard socket bind failed: " + std::string(std::strerror(errno)));
    if (::chmod(path_.c_str(), 0600) != 0 || ::listen(listener, 4) != 0)
        throw std::runtime_error("dashboard socket listen failed");

    while (!stopping_.load() && !shutdown_requested) {
        pollfd ready{listener, POLLIN, 0};
        const int polled = ::poll(&ready, 1, 250);
        if (polled < 0) { if (errno == EINTR) continue; break; }
        if (polled == 0 || !(ready.revents & POLLIN)) continue;
        const int client = ::accept4(listener, nullptr, nullptr, SOCK_CLOEXEC);
        if (client < 0) { if (errno == EINTR) continue; break; }
        client_fd_ = client;
        ucred cred{}; socklen_t cred_len = sizeof(cred);
        if (::getsockopt(client, SOL_SOCKET, SO_PEERCRED, &cred, &cred_len) != 0 || cred.uid != ::getuid()) {
            ::close(client); client_fd_ = -1; continue;
        }
        char buffer[4096];
        auto receive = [&]() -> std::string {
            iovec iov{buffer, sizeof(buffer)}; msghdr msg{};
            msg.msg_iov = &iov; msg.msg_iovlen = 1;
            const auto length = ::recvmsg(client, &msg, 0);
            if (length <= 0 || (msg.msg_flags & MSG_TRUNC)) throw std::runtime_error("dashboard connection closed or packet too large");
            return std::string(buffer, static_cast<std::size_t>(length));
        };
        try {
            pollfd handshake{client, POLLIN, 0};
            if (::poll(&handshake, 1, 2000) <= 0 || !(handshake.revents & POLLIN))
                throw std::runtime_error("dashboard hello timeout");
            const auto hello_packet = receive();
            require_utf8(hello_packet);
            const auto hello = JsonParser(hello_packet).parse();
            if (uint_field(hello, "protocol_version") != 1 || hello.at("type").string() != "hello" ||
                hello.at("role").string() != "dashboard") throw std::runtime_error("unsupported dashboard hello");
            if (!send_dashboard_packet(client, "{\"protocol_version\":1,\"type\":\"hello_ack\",\"role\":\"dashboard\"}"))
                throw std::runtime_error("dashboard hello reply failed");
            {
                std::lock_guard<std::mutex> lock(state_lock_);
                dashboard_connected_ = true;
            }
            while (!stopping_.load() && !shutdown_requested) {
                pollfd event{client, POLLIN, 0};
                const int polled_client = ::poll(&event, 1, 250);
                if (polled_client < 0) { if (errno == EINTR) continue; break; }
                if (polled_client == 0) continue;
                if (!(event.revents & POLLIN)) break;
                const auto packet = receive();
                try {
                    require_utf8(packet);
                    const auto request = JsonParser(packet).parse();
                    if (uint_field(request, "protocol_version") != 1)
                        throw std::runtime_error("unsupported protocol version");
                    const auto type = request.at("type").string();
                    std::string reply;
                    if (type == "get_status") {
                        reply = dashboard_status(runner_, *this);
                    } else if (type == "command" || type == "clear_fault") {
                        const auto id = request.at("request_id").string();
                        if (!valid_dashboard_id(id)) throw std::runtime_error("invalid request ID");
                        bool accepted = true;
                        std::string reason = "stored_in_bridge";
                        if (type == "command") {
                            const auto power = request.at("power_on").boolean();
                            const auto mode = request.at("mode").string();
                            if (!valid_mode(mode)) throw std::runtime_error("invalid headlight mode");
                            std::lock_guard<std::mutex> lock(state_lock_);
                            has_request_ = true;
                            request_id_ = id;
                            power_on_ = power;
                            mode_ = mode;
                            mode_code_ = afs_bridge::mode_code(mode);
                        } else if (can_enabled_) {
                            std::lock_guard<std::mutex> lock(state_lock_);
                            clear_fault_pending_ = true;
                            ++clear_fault_generation_;
                            reason = "queued_for_can";
                        } else {
                            accepted = false;
                            reason = "can_disabled";
                        }
                        reply = "{\"protocol_version\":1,\"type\":\"command_result\",\"request_id\":\"" + id +
                                "\",\"accepted\":" + (accepted ? "true" : "false") +
                                ",\"reason\":\"" + reason + "\"}";
                    } else throw std::runtime_error("unsupported dashboard message");
                    if (!send_dashboard_packet(client, reply)) break;
                } catch (const std::exception& error) {
                    const std::string reject = "{\"protocol_version\":1,\"type\":\"error\",\"reason\":\"invalid_request\"}";
                    std::cerr << "dashboard IPC rejected packet: " << error.what() << std::endl;
                    if (!send_dashboard_packet(client, reject)) break;
                }
            }
        } catch (const std::exception& error) {
            if (!stopping_.load() && !shutdown_requested)
                std::cerr << "dashboard IPC disconnected: " << error.what() << std::endl;
        }
        ::close(client);
        client_fd_ = -1;
        {
            std::lock_guard<std::mutex> lock(state_lock_);
            dashboard_connected_ = false;
            clear_fault_pending_ = false;
        }
    }
    const int fd = listen_fd_.exchange(-1);
    if (fd >= 0) ::close(fd);
    ::unlink(path_.c_str());
}
}  // namespace afs_bridge
