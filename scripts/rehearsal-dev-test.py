"""Synthetic tests only; never contact either hosted project."""
import base64
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("launcher", Path(__file__).with_name("rehearsal-dev.py"))
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


def token(role="anon", ref=launcher.PROJECT):
    body = base64.urlsafe_b64encode(json.dumps({"role": role, "ref": ref}).encode()).decode().rstrip("=")
    return f"synthetic.{body}.not-a-signature"


class LauncherTests(unittest.TestCase):
    def test_overrides_source_environment(self):
        env = launcher.client_environment(token(), {
            "VITE_SUPABASE_URL": "https://source.invalid",
            "VITE_SUPABASE_PUBLISHABLE_KEY": "wrong",
            "VITE_SUPABASE_PROJECT_ID": "source",
            "VITE_LOCAL_BACKEND": "true",
        })
        self.assertEqual(env["VITE_SUPABASE_URL"], f"https://{launcher.PROJECT}.supabase.co")
        self.assertEqual(env["VITE_SUPABASE_PROJECT_ID"], launcher.PROJECT)
        self.assertEqual(env["VITE_SUPABASE_PUBLISHABLE_KEY"], token())
        self.assertEqual(env["VITE_LOCAL_BACKEND"], "false")
        self.assertEqual(env["VITE_REHEARSAL_BACKEND"], "true")

    def test_rejects_wrong_project_privileged_and_malformed_keys(self):
        for key in [token(ref="source"), token(role="service_role"),
                    "sb_secret_synthetic", "sb_publishable_synthetic", "x.!!.y", "x.bnVsbA.y"]:
            with self.subTest(key=key):
                with self.assertRaises(ValueError) as error:
                    launcher.client_environment(key, {})
                self.assertNotIn(key, str(error.exception))


if __name__ == "__main__":
    unittest.main()
