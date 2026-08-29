import type { RouterData, ListContext, Options, RouterResType } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

// 新闻分类，键名与接口的 tabs 参数一致
const typeMap: Record<string, string> = {
  all: "全部",
  notices: "公告",
  events: "活动",
  news: "资讯",
};

// 接口单页最多返回 20 条
const PAGE_SIZE = 20;

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  // 未知分类回退到默认
  const rawType = c.req.query("type") || "all";
  const type = rawType in typeMap ? rawType : "all";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "endfield",
    title: "明日方舟：终末地",
    type: typeMap[type],
    description: "官方新闻与公告",
    params: {
      type: {
        name: "新闻分类",
        type: typeMap,
      },
    },
    link: "https://endfield.hypergryph.com/news",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface EndfieldNewsItem {
  cid: string;
  title: string;
  displayTime: number;
  cover: string;
  brief: string;
}

interface EndfieldResponse {
  data?: {
    list?: EndfieldNewsItem[];
  };
}

const getList = async (options: Options, noCache: boolean): Promise<RouterResType> => {
  const { type } = options;
  const typeKey = String(type);
  // 全部时不传 tabs 参数，接口即返回所有分类
  const tabParam = typeKey === "all" ? "" : `&tabs[]=${encodeURIComponent(typeKey)}`;
  const url = `https://web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&page=1&pageSize=${PAGE_SIZE}${tabParam}`;

  const result = await get<EndfieldResponse>({
    url,
    noCache,
    ttl: 1800,
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: "https://endfield.hypergryph.com/",
    },
  });

  const list = result.data?.data?.list ?? [];
  if (!list.length) {
    logger.warn(`⚠️ [WARN] 终末地新闻数据为空（ type=${typeKey} ）`);
    return { ...result, data: [] };
  }

  return {
    ...result,
    data: list.map((v) => {
      const link = `https://endfield.hypergryph.com/news/${v.cid}`;
      return {
        id: v.cid,
        title: v.title,
        desc: v.brief?.trim() || undefined,
        cover: v.cover || undefined,
        hot: undefined,
        timestamp: getTime(v.displayTime),
        url: link,
        mobileUrl: link,
      };
    }),
  };
};
