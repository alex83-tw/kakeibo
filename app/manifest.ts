import type { MetadataRoute } from "next";

// ponytail: icon.svg only; PNG icons (192/512, apple-icon) need binary assets, add when installing to the home screen matters
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "家計簿",
    short_name: "家計簿",
    description: "每天記帳，看見趨勢、預算與帳是否對得上。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f3",
    theme_color: "#f7f7f3",
    lang: "zh-Hant",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
