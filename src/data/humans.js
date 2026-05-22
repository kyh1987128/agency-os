export const HUMANS = [
  { id: "h1", dept: "marketing", name: "한지수", title: "브랜드 전략가",   avatar: "👩‍💼", color: "#f59e0b", status: "active", mood: "집중모드 🎯" },
  { id: "h2", dept: "marketing", name: "박도현", title: "SNS 매니저",      avatar: "👨‍💻", color: "#f59e0b", status: "active", mood: "트렌드 스캐닝 📱" },
  { id: "h3", dept: "content",   name: "오민준", title: "영상 PD",         avatar: "🎬",  color: "#38bdf8", status: "active", mood: "스토리보드 작성 📋" },
  { id: "h4", dept: "design",    name: "윤서아", title: "UI/UX 디자이너",  avatar: "🎨",  color: "#f472b6", status: "active", mood: "와이어프레임 중 📐" },
  { id: "h5", dept: "dev",       name: "남현석", title: "프론트엔드",       avatar: "⚡",  color: "#34d399", status: "active", mood: "코드 리뷰 중 💻" },
  { id: "h6", dept: "ops",       name: "송예린", title: "PM",              avatar: "📋",  color: "#fb923c", status: "active", mood: "스탠드업 준비 📅" },
];

export const getHuman = (id) => HUMANS.find((h) => h.id === id);
