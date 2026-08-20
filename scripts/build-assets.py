#!/usr/bin/env python3
"""Generate raster/logo/social asset sets from canonical SVG brand sources.

Dependencies:
  python3 -m pip install pillow cairosvg

Run:
  python3 scripts/build-assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cairosvg, io, json, shutil

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "img"

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def fnt(size,bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG,size)

def render_svg(path,width=1600):
    data=cairosvg.svg2png(url=str(path),output_width=width)
    return Image.open(io.BytesIO(data)).convert("RGBA")

def contain(img,size,padding=0,bg=(0,0,0,0)):
    c=Image.new("RGBA",size,bg)
    x=img.copy()
    x.thumbnail((size[0]-2*padding,size[1]-2*padding),Image.Resampling.LANCZOS)
    c.alpha_composite(x,((size[0]-x.width)//2,(size[1]-x.height)//2))
    return c

def favicon(icon,out):
    base=contain(icon,(512,512),72,"#000000")
    base.save(out,format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

def grid(size,accent):
    w,h=size
    im=Image.new("RGBA",size,"#000000")
    d=ImageDraw.Draw(im)
    for x in range(0,w,80): d.line((x,0,x,h),fill=(35,38,42,90))
    for y in range(0,h,80): d.line((0,y,w,y),fill=(35,38,42,90))
    rgb=tuple(int(accent[i:i+2],16) for i in (1,3,5))
    d.rectangle((0,0,10,h),fill=rgb+(255,))
    return im

def banner(logo,cfg,size,label):
    w,h=size
    bg=grid(size,cfg.get("accent","#5DD9E8"))
    lg=logo.copy()
    lg.thumbnail((int(w*.48),int(h*.55)),Image.Resampling.LANCZOS)
    bg.alpha_composite(lg,(int(w*.05),int(h*.18)))
    d=ImageDraw.Draw(bg)
    x=int(w*.58); y=int(h*.24)
    d.text((x,y),cfg["brand"],font=fnt(max(28,int(h*.07)),True),fill="#F5F5F5")
    d.text((x,y+max(28,int(h*.07))+12),cfg["tagline"],font=fnt(max(14,int(h*.035))),fill=cfg.get("accent","#5DD9E8"))
    if cfg.get("domain"):
        d.text((x,y+max(28,int(h*.07))+max(14,int(h*.035))+44),cfg["domain"],font=fnt(max(14,int(h*.028))),fill="#BFC3C7")
    return bg.convert("RGB")

brands = [
 ("webOwie/corporate","webOwie_horizontal_transparent.svg","webOwie_icon.svg","#5DD9E8"),
 ("webOwie/subbrands/nodeOS","webOwie_nodeOS_horizontal_fixed.svg","webOwie_nodeOS_icon.svg","#5DD9E8"),
 ("webOwie/subbrands/search","search_webOwie_horizontal.svg","search_webOwie_icon.svg","#FF2A2A"),
 ("puchalla.pro/corporate","puchalla.pro_horizontal.svg","puchalla.pro_icon.svg","#F5F5F5"),
 ("bnd.zone/corporate","bnd.zone_horizontal.svg","bnd.zone_icon.svg","#F5F5F5"),
 ("bnd.zone/subbrands/cybersicherheit","bnd.zone_cybersicherheit_horizontal.svg","bnd.zone_cybersicherheit_icon.svg","#001A44"),
]

for rel,logo_name,icon_name,accent in brands:
    base=ASSETS/rel
    cfg=json.loads((base/"brand.json").read_text())
    cfg["accent"]=accent
    svgdir=base/"logos/svg"
    out_logo=base/"logos/png"; out_logo.mkdir(parents=True,exist_ok=True)
    fav=base/"favicons"; fav.mkdir(parents=True,exist_ok=True)
    app=base/"app-icons"; app.mkdir(parents=True,exist_ok=True)
    banners=base/"banners"; banners.mkdir(parents=True,exist_ok=True)
    social=base/"social"; social.mkdir(parents=True,exist_ok=True)

    logo=render_svg(svgdir/logo_name,1800)
    icon=render_svg(svgdir/icon_name,1024)

    logo.save(out_logo/"logo-primary.png")
    contain(logo,(2048,600),72,"#000000").save(out_logo/"logo-primary-dark.png")
    favicon(icon,fav/"favicon.ico")
    for n in [16,32,48,64,96,128,256,512]:
        contain(icon,(n,n),max(1,int(n*.16)),"#000000").save(fav/f"favicon-{n}x{n}.png")
    contain(icon,(180,180),24,"#000000").save(app/"apple-touch-icon.png")
    contain(icon,(192,192),26,"#000000").save(app/"android-chrome-192x192.png")
    contain(icon,(512,512),66,"#000000").save(app/"android-chrome-512x512.png")
    contain(icon,(512,512),62,(0,0,0,0)).save(app/"pwa-maskable-512x512.png")

    for name,size in {
      "banner-1920x480.png":(1920,480),
      "banner-1920x640.png":(1920,640),
      "banner-1200x300.png":(1200,300),
    }.items():
        banner(logo,cfg,size,"banner").save(banners/name)

    for name,size in {
      "og-image-1200x630.png":(1200,630),
      "github-social-preview-1280x640.png":(1280,640),
      "x-cover-1500x500.png":(1500,500),
      "linkedin-cover-1584x396.png":(1584,396),
      "facebook-cover-1640x624.png":(1640,624),
      "youtube-banner-2560x1440.png":(2560,1440),
    }.items():
        banner(logo,cfg,size,"social").save(social/name)

print("Generated all webOwie brand asset sets under assets/img/")
