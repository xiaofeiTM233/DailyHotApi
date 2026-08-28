import type { RouterData } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

export const handleRoute = async (_: undefined, noCache: boolean) => {
  const listData = await getList(noCache);
  const routeData: RouterData = {
    name: "netease-news",
    title: "网易新闻",
    type: "热点榜",
    link: "https://m.163.com/hot",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface NeteaseItem {
  docid: string;
  title: string;
  imgsrc: string;
  source: string;
  ptime: string;
}

interface NeteaseResponse {
  data: {
    list: NeteaseItem[];
  };
}

const getList = async (noCache: boolean) => {
  const url = `https://m.163.com/fe/api/hot/news/flow`;
  const result = await get<NeteaseResponse>({
    url,
    noCache,
    // 该接口返回数据量大且偶发缓慢，放宽超时
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      Referer: "https://m.163.com/",
    },
  });
  const list = result.data?.data?.list ?? [];
  if (!list.length) {
    logger.warn("⚠️ [WARN] 网易新闻热榜数据为空");
    return { ...result, data: [] };
  }
  return {
    ...result,
    data: list.map((v) => ({
      id: v.docid,
      title: v.title,
      cover: v.imgsrc,
      author: v.source,
      hot: undefined,
      timestamp: getTime(v.ptime),
      url: `https://www.163.com/dy/article/${v.docid}.html`,
      mobileUrl: `https://m.163.com/dy/article/${v.docid}.html`,
    })),
  };
};
