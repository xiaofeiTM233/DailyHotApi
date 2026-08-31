import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { genHeaders } from "../utils/getToken/coolapk.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "coolapk",
    title: "酷安",
    type: "热榜",
    link: "https://www.coolapk.com/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface CoolapkItem {
  id: string;
  message: string;
  tpic: string;
  username: string;
  ttitle: string;
  shareUrl: string;
  // 动态详情路径，如 /feed/73507277
  url?: string;
}

interface CoolapkResponse {
  data?: CoolapkItem[];
}

const getList = async (noCache: boolean) => {
  const url = `https://api.coolapk.com/v6/page/dataList?url=/feed/statList?cacheExpires=300&statType=day&sortField=detailnum&title=今日热门&title=今日热门&subTitle=&page=1`;
  const result = await get<CoolapkResponse>({
    url,
    noCache,
    timeout: 15000,
    headers: genHeaders(),
  });
  const list = result.data?.data ?? [];
  if (!list.length) {
    logger.warn("⚠️ [WARN] 酷安热榜数据为空，签名可能已失效或被 WAF 拦截");
    return { ...result, data: [] };
  }
  return {
    ...result,
    data: list.map((v) => {
      // 优先使用 shareUrl，缺失时用详情路径或按 id 构造
      const shareUrl =
        v.shareUrl ||
        (v.url ? `https://www.coolapk.com${v.url.startsWith("/") ? v.url : `/${v.url}`}` : "") ||
        (v.id ? `https://www.coolapk.com/feed/${v.id}` : "");
      return {
        id: v.id,
        title: v.message,
        cover: v.tpic,
        author: v.username,
        desc: v.ttitle,
        timestamp: undefined,
        hot: undefined,
        url: shareUrl,
        mobileUrl: shareUrl,
      };
    }),
  };
};
