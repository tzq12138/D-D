import PyPDF2, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

pdf_path = r'F:\D&D\COC\COC7th核心规则书v1.2.1.pdf'
reader = PyPDF2.PdfReader(pdf_path)

# Extract table of contents — look for TOC-like pages
# Skip first few blank/cover pages and find the actual content
print(f"Total pages: {len(reader.pages)}")

# Scan through to find table of contents and chapter starts
for i in range(len(reader.pages)):
    text = reader.pages[i].extract_text()
    if text and len(text.strip()) > 50:
        print(f"\n{'='*60}")
        print(f"PAGE {i+1}")
        print(f"{'='*60}")
        print(text[:1200])
        if i > 30:
            break
