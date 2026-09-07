import re, glob
for file in glob.glob('src/tests/**/*.ts*', recursive=True):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    content = re.sub(r'(vi\.spyOn\(CaseContextModule, "useCase"\)\.mockReturnValue\(\{)', r'\1\n      clarify: vi.fn(),\n      acceptProvisionalClaim: vi.fn(),', content)
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
