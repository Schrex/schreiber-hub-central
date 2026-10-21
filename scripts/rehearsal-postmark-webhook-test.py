#!/usr/bin/env python3
"""Mock-only checks; never contacts providers or runs Supabase."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('webhook', Path(__file__).with_name('rehearsal-postmark-webhook.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
TOKEN = 'synthetic-server-token-for-tests-only'

class SetupTests(unittest.TestCase):
    def scenario(self, *, existing=None, server=m.SERVER, fail_post=False, verified=True):
        calls, installed, saved = [], [], {}
        def call(token, method, path, body=None):
            self.assertEqual(token, TOKEN)
            calls.append((method, path))
            if path == '/server': return {'ID': server}
            if path.startswith('/webhooks?'): return {'Webhooks': [] if existing is None else existing}
            if method == 'POST':
                if fail_post: raise m.SafeFailure('uncertain')
                saved.update(body)
                return {'ID': 456}
            return {**saved, 'ID': 456, 'Status': 'verified' if verified else 'unverified'}
        return calls, installed, saved, call

    def test_success_secret_scope_and_repeat_blocked(self):
        calls, installed, saved, call = self.scenario()
        with tempfile.TemporaryDirectory() as d:
            state = Path(d) / 'attempt.local'
            m.configure(TOKEN, state, call, installed.append, lambda secret: None)
            self.assertEqual(len(installed), 1)
            self.assertGreaterEqual(len(installed[0]), 32)
            self.assertNotEqual(installed[0], TOKEN)
            self.assertEqual(saved['HttpHeaders'][0]['Value'], installed[0])
            self.assertTrue(saved['Verify'])
            self.assertEqual(saved['Url'], m.URL)
            self.assertEqual(sum(x['Enabled'] for x in saved['Triggers'].values()), 1)
            self.assertNotIn(installed[0], state.read_text())
            self.assertEqual(os.stat(state).st_mode & 0o777, 0o600)
            with self.assertRaises(m.SafeFailure): m.configure(TOKEN, state, call, installed.append, lambda secret: None)
            self.assertEqual(calls.count(('POST', '/webhooks')), 1)

    def test_wrong_server_and_conflicts_have_no_mutations(self):
        for kwargs in ({'server': 1}, {'existing': [{'ID': 9}]}):
            calls, installed, _, call = self.scenario(**kwargs)
            with tempfile.TemporaryDirectory() as d:
                state = Path(d) / 'attempt.local'
                with self.assertRaises(m.SafeFailure): m.configure(TOKEN, state, call, installed.append, lambda secret: None)
                self.assertFalse(state.exists())
                self.assertFalse(installed)
                self.assertFalse(any(method == 'POST' for method, _ in calls))

    def test_uncertain_post_blocks_fresh_secret_and_second_post(self):
        calls, installed, _, call = self.scenario(fail_post=True)
        with tempfile.TemporaryDirectory() as d:
            state = Path(d) / 'attempt.local'
            for _ in range(2):
                with self.assertRaises(m.SafeFailure): m.configure(TOKEN, state, call, installed.append, lambda secret: None)
            self.assertEqual(len(installed), 1)
            self.assertEqual(calls.count(('POST', '/webhooks')), 1)

    def test_unverified_readback_not_success(self):
        _, installed, _, call = self.scenario(verified=False)
        with tempfile.TemporaryDirectory() as d:
            state = Path(d) / 'attempt.local'
            with self.assertRaises(m.SafeFailure): m.configure(TOKEN, state, call, installed.append, lambda secret: None)
            self.assertIn('readback pending', state.read_text())

    def test_install_uses_private_temp_and_no_secret_argv(self):
        paths = []
        def run(argv, **kwargs):
            path = Path(argv[argv.index('--env-file') + 1]); paths.append(path)
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            self.assertIn('EMAIL_DELIVERY_ENABLED=false', path.read_text())
            self.assertIn('POSTMARK_SERVER_ID=21137606', path.read_text())
            self.assertNotIn('private-test-secret', ' '.join(argv))
            self.assertEqual(argv[argv.index('--project-ref') + 1], m.PROJECT)
            return SimpleNamespace(returncode=0)
        with patch.object(m.subprocess, 'run', run): m.install('private-test-secret')
        self.assertFalse(paths[0].exists())

    def test_install_failure_cleans_private_temp(self):
        paths = []
        def run(argv, **kwargs):
            paths.append(Path(argv[-1]))
            raise RuntimeError('SENSITIVE PROVIDER BODY')
        with patch.object(m.subprocess, 'run', run):
            with self.assertRaises(m.SafeFailure) as result: m.install('private-test-secret')
        self.assertNotIn('SENSITIVE', str(result.exception))
        self.assertFalse(paths[0].exists())


    def test_synthetic_auth_insert_replay_no_mail(self):
        stored, calls = [], []
        def send(method, path, headers, body=None):
            calls.append((method, path))
            if method == 'GET':
                self.assertIn('example.invalid', path)
                return 200, stored.copy()
            self.assertEqual(path, '/functions/v1/handle-email-suppression')
            self.assertTrue(body['Recipient'].endswith('@example.invalid'))
            if headers.get(m.HEADER) != 'proof-secret': return 401, {}
            if not stored: stored.append({'reason': 'bounce'})
            return 200, {'result': 'suppressed'}
        m.prove('proof-secret', lambda: 'fake-memory-key', send)
        self.assertEqual(stored, [{'reason': 'bounce'}])
        self.assertEqual(sum(method == 'POST' for method, _ in calls), 4)

    def test_failed_proof_never_creates_provider_webhook(self):
        calls, installed, _, call = self.scenario()
        def fail(secret): raise m.SafeFailure('proof failed')
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(m.SafeFailure):
                m.configure(TOKEN, Path(d) / 'attempt.local', call, installed.append, fail)
        self.assertFalse(any(method == 'POST' for method, _ in calls))

    def test_reviewed_recovery_requires_empty_inventory_and_preserves_record(self):
        phase = 'synthetic authentication and replay proof passed; provider creation pending'
        for existing in ([], [{'ID': 9}]):
            calls, installed, _, call = self.scenario(existing=existing)
            with tempfile.TemporaryDirectory() as d:
                state = Path(d) / 'attempt.local'
                state.write_text(phase)
                if existing:
                    with self.assertRaises(m.SafeFailure):
                        m.configure(TOKEN, state, call, installed.append, lambda secret: None, resume_if_empty=True)
                    self.assertFalse(installed)
                    self.assertEqual(state.read_text(), phase)
                else:
                    m.configure(TOKEN, state, call, installed.append, lambda secret: None, resume_if_empty=True)
                    self.assertEqual(state.with_suffix('.previous').read_text(), phase)
                    self.assertEqual(len(installed), 1)
                    self.assertEqual(calls.count(('POST', '/webhooks')), 1)

    def test_wrong_recovery_phase_never_calls_provider(self):
        calls, installed, _, call = self.scenario()
        with tempfile.TemporaryDirectory() as d:
            state = Path(d) / 'attempt.local'; state.write_text('readback pending')
            with self.assertRaises(m.SafeFailure):
                m.configure(TOKEN, state, call, installed.append, lambda secret: None, resume_if_empty=True)
            self.assertFalse(calls)
            self.assertFalse(installed)

    def test_provider_error_contains_only_numeric_codes(self):
        import io
        failure = m.urllib.error.HTTPError('https://private.invalid', 422, 'SENSITIVE', {},
            io.BytesIO(b'{"ErrorCode":1364,"Message":"SENSITIVE SECRET VALUE"}'))
        opener = SimpleNamespace(open=lambda *a, **k: (_ for _ in ()).throw(failure))
        with patch.object(m.urllib.request, 'build_opener', lambda *a: opener):
            with self.assertRaises(m.SafeFailure) as result: m.api(TOKEN, 'POST', '/webhooks', {})
        self.assertIn('HTTP 422; Postmark error code 1364', str(result.exception))
        self.assertNotIn('SENSITIVE', str(result.exception))

    def test_redirect_denied(self):
        with self.assertRaises(m.SafeFailure):
            m.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test')

if __name__ == '__main__': unittest.main()
