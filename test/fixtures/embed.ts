// Entirely synthetic content; no production exports, accounts or customer material.
export const safeEmbed = {
  html: '<section class="card"><h2>Demo catalog</h2><p lang="zh-Hant">合成測試資料</p></section>',
  css: '.embed-root { color: #17324d; font-family: sans-serif } .embed-root > .card { padding: 16px; border: 1px solid #ccc; position: relative }',
};

export const forbiddenHtml = [
  '<script>alert(1)</script>', '<ScRiPt src="https://example.invalid/x.js"></ScRiPt>',
  '<div onclick="alert(1)">Test</div>', '<div ONMOUSEOVER="alert(1)">Test</div>',
  '<img src="x" onerror="alert(1)">', '<svg><script>alert(1)</script></svg>',
  '<iframe srcdoc="test"></iframe>', '<object data="https://example.invalid"></object>',
  '<style>body { color: red }</style>', '<div style="position:fixed">Test</div>',
  '<a href="javascript:alert(1)">Test</a>', '<form action="https://example.invalid">Test</form>',
  '<meta http-equiv="refresh" content="0;url=https://example.invalid">',
  '<template><script>alert(1)</script></template>', '<div id="location">Test</div>',
  '<body onload="alert(1)"><p>Test</p></body>',
];

export const forbiddenCss = [
  '@import "https://example.invalid/x.css";', '@IMPORT url(https://example.invalid/x.css);',
  'body { color:red }', 'html { color:red }', ':root { color:red }', '* { color:red }',
  '.embed-root p, body { color:red }', '.embed-root + p { color:red }',
  '.embed-root ~ div { color:red }', '.embed-root :is(body) { color:red }',
  '.embed-root { position:fixed }', '.embed-root { POSITION: FIXED }',
  '.embed-root { position: f\\69xed }', '.embed-root { position: sticky }',
  '.embed-root { color:var(--outside) }', '.embed-root { --x: red; color:red }',
  '.embed-root { background-image:url(https://example.invalid/pixel) }',
  '.embed-root { color: expression(alert(1)) }', '.embed-root { color:red!important }',
  '@media screen { .embed-root p { color:red } }', '.embed-root { color: not-a-color }',
  '.embed-root { font-family:"</style><script>alert(1)</script>" }',
];
