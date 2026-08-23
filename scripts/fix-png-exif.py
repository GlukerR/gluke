import struct, sys, os, zlib

def png_chunks(path):
    with open(path, 'rb') as f:
        sig = f.read(8)
        if sig != b'\x89PNG\r\n\x1a\n':
            return
        while True:
            head = f.read(8)
            if len(head) < 8:
                break
            (length,) = struct.unpack('>I', head[:4])
            ctype = head[4:8]
            data = f.read(length)
            f.read(4)  # crc
            yield (ctype, data)
            if ctype == b'IEND':
                break

def exif_is_bad(data):
    if len(data) < 4:
        return True
    return data[:4] not in (b'II*\x00', b'MM\x00*')

def fix_file(path, dry_run=False):
    chunks = list(png_chunks(path))
    if not any(ct == b'eXIf' and exif_is_bad(d) for ct, d in chunks):
        return False
    if dry_run:
        return True
    tmp = path + '.fixing.tmp'
    with open(path, 'rb') as src, open(tmp, 'wb') as dst:
        dst.write(b'\x89PNG\r\n\x1a\n')
        for ctype, data in chunks:
            if ctype == b'eXIf' and exif_is_bad(data):
                continue
            dst.write(struct.pack('>I', len(data)))
            dst.write(ctype)
            dst.write(data)
            dst.write(struct.pack('>I', zlib.crc32(ctype + data) & 0xffffffff))
    os.replace(tmp, path)
    return True

if __name__ == '__main__':
    dry = '--dry-run' in sys.argv
    roots = [a for a in sys.argv[1:] if not a.startswith('--')]
    fixed = 0
    for root in roots:
        if os.path.isfile(root):
            if fix_file(root, dry):
                fixed += 1
                print(('DRY: ' if dry else 'FIXED: ') + root)
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            for fn in filenames:
                if fn.lower().endswith('.png'):
                    p = os.path.join(dirpath, fn)
                    if fix_file(p, dry):
                        fixed += 1
                        print(('DRY: ' if dry else 'FIXED: ') + p)
    print(f'--- {"would fix" if dry else "fixed"} {fixed} files ---')
