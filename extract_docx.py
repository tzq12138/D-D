import zipfile, xml.etree.ElementTree as ET, os, glob, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def extract_docx(path):
    try:
        z = zipfile.ZipFile(path)
        xml_content = z.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        paragraphs = []
        for para in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            texts = []
            for t in para.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                if t.text:
                    texts.append(t.text)
            if texts:
                paragraphs.append(''.join(texts))
        return '\n'.join(paragraphs)
    except Exception as e:
        return f"Error: {e}"

base = r"F:\D&D\剧本杀\021再见卡门（4人开放）\吉普赛女郎之死"
docx_files = glob.glob(os.path.join(base, "**", "*.docx"), recursive=True)

for f in sorted(docx_files):
    rel = os.path.relpath(f, base)
    print(f"\n{'='*60}")
    print(f"FILE: {rel}")
    print(f"{'='*60}")
    text = extract_docx(f)
    print(text)
    print()
