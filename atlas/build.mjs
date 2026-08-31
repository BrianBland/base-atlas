// Builds <outDir>/SYSTEM.md and <outDir>/atlas.html from data.mjs (same folder).
// Usage: node <atlasDir>/build.mjs   — outDir = parent of atlasDir by default, or META.outDir
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { META, DECISIONS, GROUPS, ROLES, NETWORK_HOPS, NODES, FLOWS, CH, HOW_HTML } from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = META.outDir ? join(here, META.outDir) : join(here, '..');

const md = (s) =>
  String(s)
    .replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<mark>(.*?)<\/mark>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '_$1_')
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<\/p>\s*<p>/g, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

function buildSystemMd() {
  const out = [];
  out.push(`# ${META.title} — System Definition`, '');
  out.push(META.intro, '');
  out.push('## One paragraph', '', META.onePara, '');
  out.push('## Decisions locked', '', '| Axis | Decision | ADR |', '|---|---|---|');
  DECISIONS.forEach((d) => out.push(`| ${d.axis} | ${d.decision} | ${d.adr} |`));
  out.push('');
  out.push('## Cost model', '');
  META.costModel.forEach((l) => out.push(l));
  if (META.deepDive) out.push('## Deep dives', '', META.deepDive, '');
  out.push('## Network roles', '');
  out.push('The atlas opens on the network overview: five roles plus Apps and Ethereum L1 as surroundings.', '');
  for (const r of ROLES) {
    out.push(`### ${r.code} · ${r.name}`, '');
    out.push(`**In one line.** ${md(r.one)}`, '');
    out.push(`**What it does.** ${md(r.what)}`, '');
    out.push(`**How it's built.** ${md(r.how)}`, '');
    out.push(`**E2E components.** ${(r.components || []).join(', ') || '—'}`, '');
    if (r.contains && r.contains.length) {
      out.push(`**Contains.** ${r.contains.join(', ')} — this plate wraps those roles on the e2e map.`, '');
    }
  }
  out.push('## Network hops', '', '| # | From → To | Packet | Representative payload |', '|---|---|---|---|');
  NETWORK_HOPS.forEach((h, i) => out.push(`| ${i + 1} | ${h[0]} → ${h[1]} | ${h[2]} | \`${JSON.stringify(h[3]).replace(/\|/g, '\\|')}\` |`));
  out.push('');
  out.push('## Reading order (the e2e chapter tour)', '');
  CH.forEach((c, i) => out.push(`${i + 1}. **${c.title}** — ${md(c.lede)}${c.reveal.length ? ` _(adds ${c.reveal.join(', ')})_` : ''}`));
  out.push('');
  out.push('## Structures', '');
  for (const g of GROUPS) {
    out.push(`### ${g.title}`, '');
    for (const n of NODES.filter((n) => n.group === g.id)) {
      out.push(`#### ${n.code} · ${n.name}`, '');
      out.push(`**In one line.** ${md(n.one)}`, '');
      out.push(`**What it does.** ${md(n.what)}`, '');
      out.push(`**How it's built.** ${md(n.how)}`, '');
      if (n.steps) {
        out.push('**Steps in execution.**', '');
        n.steps.forEach((s, i) => out.push(`${i + 1}. **${s[0]}** — ${s[1]}`));
        out.push('');
      }
    }
  }
  out.push('## Flows (representative packets)', '', 'Payload shapes are what the design implies, not measured traffic.', '');
  for (const f of FLOWS) {
    out.push(`### ${f.name}`, '', '| # | From → To | Packet | Representative payload |', '|---|---|---|---|');
    f.hops.forEach((h, i) => out.push(`| ${i + 1} | ${h[0]} → ${h[1]} | ${h[2]} | \`${JSON.stringify(h[3]).replace(/\|/g, '\\|')}\` |`));
    out.push('');
  }
  if (META.platformGives || META.weOwn) out.push('## What the platform gives vs what we own', '', `**Platform gives:** ${META.platformGives||''}`, '', `**We own:** ${META.weOwn||''}`, '');
  if (META.filesystem) out.push('## Planned filesystem', '', '```', META.filesystem.trimEnd(), '```', '');
  out.push('## How this file is maintained', '', `Generated from \`${META.sourcePath||'atlas/data.mjs'}\` by \`${META.buildCmd||'node atlas/build.mjs'}\`, which also builds the interactive atlas (\`atlas.html\`${META.artifactUrl?`, published at ${META.artifactUrl}`:''}). Edit the data file, rebuild, republish — never edit this file by hand.`, '');
  return out.join('\n');
}

function buildAtlasHtml() {
  const tpl = readFileSync(join(here, 'template.html'), 'utf8');
  const decisionsHtml = DECISIONS.map((d) => `<li><b>${d.axis}.</b> ${md(d.decision).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\[(.*?)\]\((.*?)\)/g, '$1')}</li>`).join('');
  const data = [
    `const GROUPS = ${JSON.stringify(GROUPS)};`,
    `const ROLES = ${JSON.stringify(ROLES)};`,
    `const NETWORK_HOPS = ${JSON.stringify(NETWORK_HOPS)};`,
    `const NODES = ${JSON.stringify(NODES)};`,
    `const FLOWS = ${JSON.stringify(FLOWS)};`,
    `const CH = ${JSON.stringify(CH)};`,
    `const HOW_HTML = ${JSON.stringify(HOW_HTML)};`,
    `const DECISIONS_HTML = ${JSON.stringify(decisionsHtml)};`,
  ].join('\n');
  return tpl.replace('__TITLE__', META.title + ' Atlas').replace('/*__DATA__*/', data + `\nconst STATS = ${JSON.stringify(META.stats||[])};\nconst TITLE = ${JSON.stringify(META.title||'System')};`);
}

writeFileSync(join(outDir, 'SYSTEM.md'), buildSystemMd());
writeFileSync(join(outDir, 'atlas.html'), buildAtlasHtml());
console.log(`built SYSTEM.md + atlas.html · ${ROLES.length} roles · ${NODES.length} structures · ${DECISIONS.length} decisions`);
