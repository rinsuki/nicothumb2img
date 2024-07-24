import chromium from "chrome-aws-lambda"
import { NowRequest, NowResponse } from "@vercel/node"
import fs from "fs"
import path from "path"
import ejs from "ejs"

async function getThumbURL(videoID: string) {
    if (videoID.startsWith("im") || videoID.startsWith("mg")) {
        return `https://ext.seiga.nicovideo.jp/thumb/${videoID}`
    }
    if (videoID.startsWith("lv")) {
        return `https://live.nicovideo.jp/embed/${videoID}`
    }
    // until actual release
    try {
        const html = await htmlBuilderFromSnapshotSearch(videoID)
        if (html != null) {
            return `data:text/html;base64,` + Buffer.from(html, "utf-8").toString("base64")
        }
    } catch(e) {
        console.error(e)
    }
    return `https://ext.nicovideo.jp/thumb/${videoID}`
}

async function htmlBuilderFromSnapshotSearch(videoID: string) {
    const res = await fetch("https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search?q=&fields=contentId,title,startTime,viewCounter,likeCounter,commentCounter,mylistCounter,lengthSeconds,startTime,lastResBody,description,thumbnailUrl&_sort=_score&filters[contentId][0]=" + encodeURIComponent(videoID))
    if (!res.ok) return null
    const json = await res.json()
    const data = json.data && json.data[0]
    if (data == null) return null
    return await ejs.renderFile("template.ejs", {
        data,
        readableNumber(number: number) {
            return number.toLocaleString("en-US")
        },
        readableTime(number: number) {
            return `${Math.floor(number / 60)}:${(number % 60).toString().padStart(2, "0")}`
        },
        readableDate(dateString: string) {
            const date = new Date(dateString)
            const f = (number: number) => number.toString().padStart(2, "0")
            return [
                f(date.getFullYear() % 100),
                "/",
                f(date.getMonth() + 1),
                "/",
                f(date.getDate()),
                " ",
                f(date.getHours()),
                ":",
                f(date.getMinutes()),
            ].join("")
        }
    })
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
        await page.goto(await getThumbURL(videoID))
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