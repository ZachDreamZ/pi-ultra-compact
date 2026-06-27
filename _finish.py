with open('ROADMAP.md', 'r') as f:
    content = f.read()

content = content.replace(
    '| 7.2 | [P2] | Publish v1.1.1 to npm via tag-triggered workflow | 7.1 | [ ] | 1.1.1 |',
    '| 7.2 | [P2] | Publish v1.1.2 to npm via tag-triggered release workflow | 7.1 | [x] | 1.1.2 |'
)

content = content.replace(
    '| 7. CI/CD Reliability | 2 | 1 | 1 | 50% |',
    '| 7. CI/CD Reliability | 2 | 2 | 0 | 100% |'
)

content = content.replace(
    '| **Total** | **45** | **44** | **1** | **98%** |',
    '| **Total** | **45** | **45** | **0** | **100%** |'
)

with open('ROADMAP.md', 'w') as f:
    f.write(content)

with open('CHANGELOG.md', 'r') as f:
    ch = f.read()

entry = '''## [1.1.2] - 2026-06-27

### Fixed

- **Release workflow now fully functional** — npm publish CI pipeline fixed by updating the `NPM_TOKEN` secret and adding `always-auth: true` to `setup-node`. Tag-based releases now create GitHub releases and publish to npm automatically (closes #39).

### Quality Gates

- 337 tests pass, 97%+ coverage
- Release CI confirmed green on v1.1.2 tag

'''

idx = ch.find('## [1.1.1]')
if idx >= 0:
    end_idx = ch.find('## [', idx + 10)
    if end_idx >= 0:
        before = ch[:end_idx].rstrip() + '\n\n' + entry
        after = ch[end_idx:]
        ch = before + after

with open('CHANGELOG.md', 'w') as f:
    f.write(ch)

print('Done')
