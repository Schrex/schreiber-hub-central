import { describe, expect, it } from 'vitest';
import { classifyTalkMedia } from '@/lib/talkMedia';
const destination = 'https://destination.example.test';
const source = 'https://bitogpfplcquovpdjprk.supabase.co';

describe('private destination safety media', () => {
  it.each([source, destination])('signs known-host media using the original object key', origin => {
    expect(classifyTalkMedia(`${origin}/storage/v1/object/public/talk-media/talks/file%20name.png`, destination)).toEqual({ kind: 'storage', path: 'talks/file name.png' });
    expect(classifyTalkMedia(`${origin}/storage/v1/object/sign/talk-media/a.mp4?token=old`, destination)).toEqual({ kind: 'storage', path: 'a.mp4' });
  });
  it('preserves ordinary HTTPS external videos', () => {
    expect(classifyTalkMedia('https://media.example.test/video.mp4', destination)).toEqual({ kind: 'external', url: 'https://media.example.test/video.mp4' });
  });
  it.each([
    `${source}/storage/v1/object/public/other-bucket/file.png`,
    `${source}/storage/v1/object/public/talk-media/a/%2e%2e%2fb.png`,
    `${source}/storage/v1/object/public/talk-media/%ZZ`,
    'javascript:alert(1)', 'http://example.test/video.mp4', 'not a url',
  ])('refuses unsafe or unrecognized source paths without a source fallback: %s', value => {
    expect(classifyTalkMedia(value, destination)).toEqual({ kind: 'unavailable' });
  });
});
