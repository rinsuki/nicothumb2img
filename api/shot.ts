import chromium from "chrome-aws-lambda"
import { NowRequest, NowResponse } from "@vercel/node"
import fs from "fs"
import path from "path"

function getThumbURL(videoID: string) {
    if (videoID.startsWith("im") || videoID.startsWith("mg")) {
        return `https://ext.seiga.nicovideo.jp/thumb/${videoID}`
    }
    if (videoID.startsWith("lv")) {
        return `https://live.nicovideo.jp/embed/${videoID}`
    }
    return `https://ext.nicovideo.jp/thumb/${videoID}`
}

function chromiumFontSetup() {
    if (process.env.HOME == null) process.env.HOME = "/tmp"
    const dest = process.env.HOME + "/.fonts"
    if (!fs.existsSync(dest)) fs.mkdirSync(dest)
    const src = __dirname+"/../fonts/mplus"
    for (const font of fs.readdirSync(src)) {
        if (!font.endsWith(".ttf")) continue
        if (fs.existsSync(path.join(dest, font))) continue
        fs.copyFileSync(path.join(src, font), path.join(dest, font))
    }
}

async function shot(videoID: string) {
    chromiumFontSetup()
    const { puppeteer } = chromium
    const agent = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: {
            deviceScaleFactor: 2,
            // + 2 はこっちで付け足す border 用
            width: 312 + 2,
            height: 176 + 2,
        },
        executablePath: await chromium.executablePath,
        env: {
            ...process.env,
            LANG: "ja_JP.UTF-8"
        }
    })
    const page = await agent.newPage()
    try {
        await page.goto(getThumbURL(videoID))
        await Promise.all([
            page.addStyleTag({
                // 上のドット絵をきれいに表示するように
                content: "body > table img { image-rendering: pixelated; }",
            }),
            page.addStyleTag({
                // iframeで付くはずの枠を自分で付ける
                content: "html { margin: 1px; } html::before { display: block; content: \"\"; position: fixed; top: 0; left: 0; width: calc(100vw - 2px); height: calc(100vh - 2px); border: 1px solid #ccc;} ",
            })
        ])
        return await page.screenshot({type: "png"})
    } finally {
        await page.close()
    }
}

export default async function (req: NowRequest, res: NowResponse) {
    res.setHeader("X-Robots-Tag", "noindex")
    const videoID = req.query["id"]
    if (typeof videoID !== "string") return res.status(400).write("invalid id")
    if (!/^[a-z]{2}[1-9][0-9]*$/.test(videoID)) return res.status(400).write("wrong id")
    res.setHeader("Link", `<https://nico.ms/${videoID}>; rel="canonical"`)
    const img = await shot(videoID)
    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "max-age=86400, public, stale-while-revalidate")
    res.setHeader("Content-DPR", "2.0")
    res.send(img)
}