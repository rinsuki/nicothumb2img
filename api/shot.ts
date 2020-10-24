import { firefox } from "playwright-firefox"
import { NowRequest, NowResponse } from "@vercel/node"

const agentPromise = firefox.launch({
    headless: true,
})

function getThumbURL(videoID: string) {
    if (videoID.startsWith("im") || videoID.startsWith("mg")) {
        return `https://ext.seiga.nicovideo.jp/thumb/${videoID}`
    }
    return `https://ext.nicovideo.jp/thumb/${videoID}`
}

async function shot(videoID: string) {
    const agent = await agentPromise
    const page = await agent.newPage({
        deviceScaleFactor: 2,
        locale: "ja-JP",
        viewport: {
            width: 312 + 2,
            height: 176 + 2,
        }
    })
    try {
        await page.goto(getThumbURL(videoID))
        await Promise.all([
            page.addStyleTag({
                // 上のドット絵をきれいに表示するように
                content: "body > table img { image-rendering: crisp-edges; }",
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

export default function (req: NowRequest, res: NowResponse) {
    const videoID = req.query["id"]
    if (typeof videoID !== "string") return res.status(400).write("invalid id")
    if (!/^[a-z]{2}[1-9][0-9]*$/.test(videoID)) return res.status(400).write("wrong id")
    const img = shot(videoID)
    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "max-age=86400, public, stale-while-revalidate")
    res.send(img)
}