import type { RouterData, ListContext, Options } from "../types.js";
import { get } from "../utils/getData.js";
import { parseRSS } from "../utils/parseRSS.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

const typeMap: Record<string, string> = {
  hot: "最新热门",
  digest: "最新精华",
  new: "最新回复",
  newthread: "最新发表",
};

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  // 未知分类回退到默认
  const rawType = c.req.query("type") || "hot";
  const type = rawType in typeMap ? rawType : "hot";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "hostloc",
    title: "全球主机交流",
    type: typeMap[type],
    params: {
      type: {
        name: "榜单分类",
        type: typeMap,
      },
    },
    link: "https://hostloc.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

const getList = async (options: Options, noCache: boolean) => {
  const type = String(options.type ?? "hot");
  const url = `https://hostloc.com/forum.php?mod=guide&view=${type}&rss=1`;
  const result = await get<string>({
    url,
    noCache,
    timeout: 15000,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://hostloc.com/",
    },
  });
  const list = await parseRSS(result.data);
  if (!list.length) {
    logger.warn(`⚠️ [WARN] 全球主机交流数据为空（ type=${type} ），可能被风控拦截`);
  }
  return {
    ...result,
    data: list.map((v, i) => ({
      id: v.guid || i,
      title: v.title || "",
      desc: v.content || "",
      author: v.author || "",
      timestamp: getTime(v.pubDate || 0),
      hot: undefined,
      url: v.link || "",
      mobileUrl: v.link || "",
    })),
  };
};
