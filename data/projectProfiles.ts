import { Project, ProjectKind } from "../types";

export function isCommerceProject(project: Pick<Project, "idea" | "kind">) {
  return (
    project.kind === "web" &&
    /卖衣服|服装|衣服|服饰|电商|商城|网店|购物车|商品|支付|零售|shop|store|commerce|e-?commerce|fashion|clothing|apparel|retail/i.test(
      project.idea,
    )
  );
}

export function profileFor(project: Pick<Project, "idea" | "kind">) {
  if (isCommerceProject(project)) {
    return {
      label: "服装电商网站",
      keywords: [
        "ecommerce",
        "commerce",
        "shop",
        "storefront",
        "cart",
        "payment",
        "product-catalog",
        "fashion",
        "retail",
      ],
      curatedRepos: [
        "medusajs/medusa",
        "saleor/saleor",
        "vercel/commerce",
        "vendure-ecommerce/vendure",
      ],
      workflow: [
        "商品与库存建模",
        "购物车与结算验证",
        "支付与订单闭环",
        "移动端体验与转化优化",
        "上线前安全与运营验收",
      ],
    };
  }
  const labels: Record<ProjectKind, string> = {
    video: "视频项目",
    web: "Web 项目",
    cad: "CAD 项目",
    pcb: "PCB 项目",
    automation: "自动化项目",
    general: "通用项目",
  };
  return {
    label: labels[project.kind],
    keywords: [],
    curatedRepos: [],
    workflow: [
      "需求与参考项目研究",
      "核心技术验证",
      "最小闭环实现",
      "质量验证",
      "交付上线",
    ],
  };
}
