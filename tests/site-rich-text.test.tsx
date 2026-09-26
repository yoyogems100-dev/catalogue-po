import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText, richTextToPlain, safeHref } from '../lib/site/rich-text';

test('rich text keeps only bold, italic, bullet lists, links and paragraphs', () => {
  assert.equal(sanitizeRichText('<p>Same <b>colour</b>, same <i>cut</i>.</p>'), '<p>Same <strong>colour</strong>, same <em>cut</em>.</p>');
  assert.equal(sanitizeRichText('<ul><li>One</li><li>Two</li></ul>'), '<ul><li>One</li><li>Two</li></ul>');
  assert.equal(sanitizeRichText('<ol><li>One</li></ol>'), '<ul><li>One</li></ul>');
  assert.equal(sanitizeRichText('Plain line'), '<p>Plain line</p>');
  assert.equal(sanitizeRichText('<div>A</div><div>B</div>'), '<p>A</p><p>B</p>');
  assert.equal(sanitizeRichText('<h2>Title</h2>'), '<p>Title</p>');
  assert.equal(sanitizeRichText('<span style="color:red"><font>Kept</font></span>'), '<p>Kept</p>');
});

test('rich text can never carry script, handlers, styles or unsafe links', () => {
  const dirty = '<p onclick="x()">Hi<script>alert(1)</script><style>p{}</style><img src=x onerror=alert(1)></p>'
    + '<a href="javascript:alert(1)">bad</a><a href=" java\tscript:alert(1)">bad2</a><iframe src="//evil"></iframe>';
  const clean = sanitizeRichText(dirty);
  assert.doesNotMatch(clean, /script|onclick|onerror|style|iframe|img|javascript/i);
  assert.equal(clean, '<p>Hi</p><p>badbad2</p>'); // text survives, tags do not
  assert.equal(sanitizeRichText('<p>&lt;script&gt;</p>'), '<p>&lt;script&gt;</p>');
  assert.equal(sanitizeRichText('<p><a href="https://wa.me/91" onclick="x">Chat</a></p>'),
    '<p><a href="https://wa.me/91" target="_blank" rel="noopener noreferrer">Chat</a></p>');
  assert.equal(sanitizeRichText('<p><a href="/charts">Charts</a></p>'), '<p><a href="/charts">Charts</a></p>');
  assert.equal(safeHref('//evil.com'), null);
  assert.equal(safeHref('data:text/html,x'), null);
});

test('rich text survives messy pastes and gives a plain-text version', () => {
  assert.equal(sanitizeRichText('<p>Open <b>bold'), '<p>Open <strong>bold</strong></p>');
  assert.equal(sanitizeRichText('<p></p><p> </p><ul></ul>'), '');
  assert.equal(richTextToPlain('<p>A &amp; B</p><ul><li>C</li></ul>'), 'A & B C');
});
