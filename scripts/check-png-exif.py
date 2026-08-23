import struct, sys, os

def png_chunks(path):
    """Yield (chunk_type, data) for a PNG file."""
    with open(path, 'rb') as f:
        sig = f.read(8)
        if sig != b'\x89PNG\r\n\x1a\n':
            yield ('NOT_PNG', b'')
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

def exif_status(path):
    try:
        for ctype, data in png_chunks(path):
            if ctype == b'eXIf':
                if len(data) >= 4:
                    magic = data[:4]
                    if magic in (b'II*\x00', b'MM\x00*'):
                        return 'ok'
                    else:
                        return f'BAD (starts with {magic.hex()})'
                else:
                    return 'BAD (too short)'
        return 'no-exif'
    except Exception as e:
        return f'error: {e}'

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'scan':
        root = sys.argv[2]
        bad = []
        total = 0
        noexif = 0
        for dirpath, dirnames, filenames in os.walk(root):
            for fn in filenames:
                if fn.lower().endswith('.png'):
                    p = os.path.join(dirpath, fn)
                    total += 1
                    st = exif_status(p)
                    if st.startswith('BAD'):
                        bad.append((p, st))
                    elif st == 'no-exif':
                        noexif += 1
        print(f'TOTAL PNG: {total}')
        print(f'NO EXIF chunk: {noexif}')
        print(f'BAD EXIF: {len(bad)}')
        for p, st in bad[:60]:
            print(f'  BAD  {p}  [{st}]')
    else:
        for p in sys.argv[1:]:
            print(p, '->', exif_status(p))
