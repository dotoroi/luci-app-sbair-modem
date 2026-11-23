#!/usr/bin/env python3
"""Minimal po2lmo-compatible builder for this singular (non-plural) LuCI catalog.

This follows OpenWrt LuCI's documented lmo entry format and SuperFastHash
(see openwrt/luci, modules/luci-base/src/po2lmo.c and src/lib/lmo.c).
Intended only for catalogs without msgctxt/msgid_plural; use upstream po2lmo
for general catalogs. Standard-library Python; does not flash a device.
"""
from __future__ import annotations
import ast,pathlib,re,struct,sys
M=0xffffffff

def sfh_hash(data:bytes)->int:
    h=len(data)
    if not data:return 0
    off=0
    blocks=len(data)>>2
    for _ in range(blocks):
        h=(h+data[off]+(data[off+1]<<8))&M
        tmp=(((data[off+2]+(data[off+3]<<8))<<11)^h)&M
        h=((h<<16)^tmp)&M
        off+=4
        h=(h+(h>>11))&M
    rem=len(data)&3
    if rem==3:
        h=(h+data[off]+(data[off+1]<<8))&M
        h=(h^(h<<16))&M
        signed=data[off+2] if data[off+2]<128 else data[off+2]-256
        h=(h^(signed<<18))&M
        h=(h+(h>>11))&M
    elif rem==2:
        h=(h+data[off]+(data[off+1]<<8))&M
        h=(h^(h<<11))&M
        h=(h+(h>>17))&M
    elif rem==1:
        signed=data[off] if data[off]<128 else data[off]-256
        h=(h+signed)&M
        h=(h^(h<<10))&M
        h=(h+(h>>1))&M
    h=(h^(h<<3))&M
    h=(h+(h>>5))&M
    h=(h^(h<<4))&M
    h=(h+(h>>17))&M
    h=(h^(h<<25))&M
    h=(h+(h>>6))&M
    return h

def extract(quoted:str)->str:
    # Hash the decoded gettext message ID, including real line breaks.
    return ast.literal_eval(quoted)

def parse(path):
    pairs=[];key=None;value=None;mode=None
    def emit():
        if key is not None and value is not None:
            pairs.append((key,value))
    for line in path.read_text(encoding='utf-8').splitlines()+['msgid ""']:
        if line.startswith('#'):continue
        if line.startswith('msgid_plural') or line.startswith('msgctxt ') or line.startswith('msgstr['):
            raise ValueError('plural/context catalogs require the upstream po2lmo')
        if line.startswith('msgid '):
            emit();key=extract(line[6:]);value=None;mode='id'
        elif line.startswith('msgstr '):value=extract(line[7:]);mode='str'
        elif line.startswith('"') and mode=='id':key+=extract(line)
        elif line.startswith('"') and mode=='str':value+=extract(line)
        else:mode=None
    return pairs

def build(inp: pathlib.Path,out:pathlib.Path):
    blobs=bytearray();indices=[];hashes=set()
    for key,val in parse(inp):
        if not key or not val or key==val:continue
        # LuCI normalizes ASCII whitespace before hashing a runtime key.
        canonical=re.sub(r"[ \t\n\r\v\f]+", " ", key).strip(" ")
        b=val.encode()
        h=sfh_hash(canonical.encode())
        if h in hashes:raise ValueError(f'LMO hash collision: {key!r}')
        hashes.add(h)
        offset=len(blobs);blobs.extend(b);blobs.extend(b'\0'*((-len(b))%4))
        indices.append((h,1,offset,len(b)))
    if not indices:raise ValueError('no translations')
    out.parent.mkdir(parents=True,exist_ok=True)
    with out.open('wb') as f:
        f.write(blobs)
        for row in sorted(indices):f.write(struct.pack('>4I',*row))
        f.write(struct.pack('>I',len(blobs)))
    # Verify every archive index points to the original translation payload.
    data=out.read_bytes();n=struct.unpack('>I',data[-4:])[0]
    assert n==len(blobs)
    decoded=[struct.unpack('>4I',data[n+i:n+i+16]) for i in range(0,len(indices)*16,16)]
    assert all(v==1 and o+l<=n for _,v,o,l in decoded)
    assert decoded==sorted(decoded)
    print(f'created {out}: {len(indices)} indexed translations, {len(data)} bytes')
    return len(indices)
if __name__=='__main__':
    if len(sys.argv)!=3:sys.exit('usage: po2lmo-fallback.py input.po output.lmo')
    build(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]))
