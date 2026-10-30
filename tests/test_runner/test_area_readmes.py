from pathlib import Path
import unittest


REPOSITORY = Path(__file__).resolve().parents[2]


class TestAreaReadmeTests(unittest.TestCase):
    def test_each_top_level_test_area_has_a_readme(self) -> None:
        areas = sorted(
            path
            for path in (REPOSITORY / "tests").iterdir()
            if path.is_dir() and path.name != "__pycache__"
        )
        missing = [
            path.relative_to(REPOSITORY).as_posix()
            for path in areas
            if not (path / "README.md").is_file()
        ]
        self.assertEqual(missing, [], f"test areas missing README.md: {missing}")

    def test_can_readme_explains_bridge_and_ecu_test_areas(self) -> None:
        can_readme = (REPOSITORY / "tests/can/README.md").read_text()
        self.assertIn("bridge/", can_readme)
        self.assertIn("ecu/", can_readme)


if __name__ == "__main__":
    unittest.main()
