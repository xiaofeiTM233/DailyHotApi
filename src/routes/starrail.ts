import type { RouterData, ListContext, Options } from "../types.js";
import { get } from "../utils/getData.js";
import { getTime } from "../utils/getTime.js";
import logger from "../utils/logger.js";

const typeMap: Record<string, string> = {
  1: "公告",
  2: "活动",
  3: "资讯",
};

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  // 未知分类回退到默认，避免请求到不存在的接口
  const rawType = c.req.query("type") || "1";
  const type = rawType in typeMap ? rawType : "1";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "starrail",
    title: "崩坏：星穹铁道",
    type: "最新动态",
    params: {
      type: {
        name: "榜单分类",
        type: typeMap,
      },
    },
    link: "https://www.miyoushe.com/sr/home/53",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

interface MiyoushePostData {
  post_id: string;
  subject: string;
  content: string;
  cover: string;
  images?: string[];
  created_at: number;
  view_status: number;
}

interface MiyousheUser {
  nickname: string;
}

interface MiyousheItem {
  post: MiyoushePostData;
  user?: MiyousheUser;
}

interface MiyousheResponse {
  data?: {
    list: MiyousheItem[];
  } | null;
}

const getList = async (options: Options, noCache: boolean) => {
  const { type } = options;
  const url = `https://bbs-api-static.miyoushe.com/painter/wapi/getNewsList?client_type=4&gids=6&page_size=20&type=${type}`;
  const result = await get<MiyousheResponse>({
    url,
    noCache,
    timeout: 15000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.miyoushe.com/sr/",
    },
  });
  const list = result.data?.data?.list ?? [];
  if (!list.length) {
    logger.warn(`⚠️ [WARN] 星穹铁道动态数据为空（ type=${type} ）`);
    return { ...result, data: [] };
  }
  return {
    ...result,
    data: list.map((v) => {
      const data = v.post;
      return {
        id: data.post_id,
        title: data.subject,
        // 列表接口已不再返回正文，仅在有内容时输出
        desc: data.content || undefined,
        cover: data.cover || data?.images?.[0],
        author: v.user?.nickname || undefined,
        timestamp: getTime(data.created_at),
        // 列表接口不再返回浏览量，避免展示恒为 0 的热度
        hot: data.view_status || undefined,
        url: `https://www.miyoushe.com/sr/article/${data.post_id}`,
        mobileUrl: `https://m.miyoushe.com/sr/#/article/${data.post_id}`,
      };
    }),
  };
};
