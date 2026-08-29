import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import getWeiboCookie from "../utils/getToken/weibo.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "weibo",
    title: "微博",
    type: "热搜榜",
    description: "实时热点，每分钟更新一次",
    link: "https://s.weibo.com/top/summary/",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface WeiboItem {
  word?: string;
  word_scheme?: string;
  // 热度值
  num?: number;
  // 广告标记，值为 1 时表示广告
  is_ad?: number | string;
}

interface WeiboResponse {
  data?: {
    realtime?: WeiboItem[];
  };
}

// 微博接口需要携带 Cookie 中的 SUB 字段，此处自动申请访客 Cookie
const getList = async (noCache: boolean) => {
  const url = "https://weibo.com/ajax/side/bandUnified?type=hot";
  const cookie = await getWeiboCookie(noCache);

  const result = await get<WeiboResponse>({
    url,
    noCache,
    ttl: 60,
    headers: {
      Referer: "https://weibo.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

  const list = result.data?.data?.realtime ?? [];
  if (!list.length) {
    logger.warn("⚠️ [WARN] 微博热搜数据为空，访客 Cookie 可能已失效");
    return { ...result, data: [] };
  }

  // 过滤广告条目
  const items = list.filter((v) => Number(v?.is_ad ?? 0) !== 1);
  if (items.length < list.length) {
    logger.info(`🚫 [FILTER] 已过滤 ${list.length - items.length} 条微博广告`);
  }

  return {
    ...result,
    data: items.map((v, index: number) => {
      const title = v.word || v.word_scheme || `热搜${index + 1}`;
      return {
        id: v.word_scheme || `weibo-${index}`,
        title: title,
        desc: v.word_scheme || `#${title}#`,
        hot: v.num,
        // 该接口不返回上榜时间
        timestamp: undefined,
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
        mobileUrl: `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}`,
      };
    }),
  };
};
