import { NowRequest, NowResponse } from "@vercel/node";

export default function (req: NowRequest, res: NowResponse) {
    res.setHeader("X-Robots-Tag", "noindex")
    const videoID = req.query["id"]
    if (typeof videoID !== "string") return res.status(400).write("invalid id")
    if (!/^[a-z]{2}[1-9][0-9]*$/.test(videoID)) return res.status(400).write("wrong id")
    res.setHeader("Link", `<https://nico.ms/${videoID}>; rel="canonical"`)
    res.setHeader("Content-Type", "image/svg+xml")
    res.setHeader("Cache-Control", "max-age=86400, s-maxage=864000, public")
    res.send(`<?xml version="1.0" ?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="314" height="178"><image width="314" height="178" xlink:href="/image/${videoID}" /></svg>`)
}