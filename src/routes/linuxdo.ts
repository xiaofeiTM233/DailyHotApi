import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import { parseRSS } from "../utils/parseRSS.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "linuxdo",
    title: "Linux.do",
    type: "热门文章",
    description: "Linux 技术社区热搜",
    link: "https://linux.do/top/weekly",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

const getList = async (noCache: boolean) => {
  const url = "https://linux.do/top.rss?period=weekly";
  const result = await get<string>({
    url,
    noCache,
    timeout: 15000,
    responseType: "text",
    headers: {
      "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  });

  const xml = typeof result.data === "string" ? result.data : "";
  const items = await parseRSS(xml);
  const list = items.map((item, index) => {
    const link = item.link || "";
    return {
      id: item.guid || link || index,
      title: item.title || "",
      desc: item.contentSnippet?.trim() || item.content?.trim() || "",
      author: item.author,
      timestamp: getTime(item.pubDate || 0),
      url: link,
      mobileUrl: link,
      hot: undefined,
    };
  });

  if (!list.length) {
    logger.warn("⚠️ [WARN] Linux.do 数据为空，可能被风控拦截");
  }

  return {
    ...result,
    data: list,
  };
};
