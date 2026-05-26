// PixelAvatar.jsx
// id별로 고유한 픽셀아트 캐릭터 SVG를 반환합니다

export default function PixelAvatar({ id = "default", size = 32, color = "#818cf8" }) {
  const PIXEL = size / 16;

  // id에 따른 고유 캐릭터 생성 (seed 기반)
  const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const hairColors = ["#1a1a1a", "#8B4513", "#D2691E", "#FFD700", "#FF6B6B", "#4B0082", "#2c3e50", "#7f8c8d"];
  const skinColors = ["#FDBCB4", "#F1C27D", "#E8BEAC", "#C68642", "#8D5524", "#FDDBB4"];

  const hairColor = hairColors[seed % hairColors.length];
  const skinColor = skinColors[(seed * 3) % skinColors.length];
  const isFemaleFace = seed % 2 === 0;
  const hasGlasses = seed % 5 === 0;

  // 옷 색상 변형 (color를 기반으로)
  const shirtColor = color;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ imageRendering: "pixelated", display: "block", flexShrink: 0 }}
    >
      {/* 배경 */}
      <rect x="0" y="0" width="16" height="16" rx="3" fill={color + "18"} />

      {/* 머리카락 - 상단 */}
      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => (
        <rect key={`ht${x}`} x={x} y={1} width={1} height={1} fill={hairColor} />
      ))}

      {/* 머리카락 - 옆 */}
      <rect x={2} y={2} width={1} height={2} fill={hairColor} />
      <rect x={13} y={2} width={1} height={2} fill={hairColor} />

      {/* 긴 머리 (여성) */}
      {isFemaleFace && (
        <>
          <rect x={2} y={4} width={1} height={4} fill={hairColor} />
          <rect x={13} y={4} width={1} height={4} fill={hairColor} />
          <rect x={3} y={7} width={1} height={2} fill={hairColor} />
          <rect x={12} y={7} width={1} height={2} fill={hairColor} />
        </>
      )}

      {/* 얼굴 피부 */}
      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) =>
        [2, 3, 4, 5, 6, 7].map((y) => (
          <rect key={`f${x}${y}`} x={x} y={y} width={1} height={1} fill={skinColor} />
        ))
      )}

      {/* 눈 */}
      <rect x={4} y={4} width={2} height={1} fill="#2d3748" />
      <rect x={10} y={4} width={2} height={1} fill="#2d3748" />

      {/* 눈 하이라이트 */}
      <rect x={5} y={4} width={1} height={1} fill="#ffffff" opacity="0.6" />
      <rect x={11} y={4} width={1} height={1} fill="#ffffff" opacity="0.6" />

      {/* 안경 (일부 캐릭터) */}
      {hasGlasses && (
        <>
          <rect x={3} y={4} width={4} height={2} fill="none" stroke="#4a5568" strokeWidth="0.3" />
          <rect x={9} y={4} width={4} height={2} fill="none" stroke="#4a5568" strokeWidth="0.3" />
          <rect x={7} y={5} width={2} height={1} fill="#4a5568" opacity="0.5" />
        </>
      )}

      {/* 입 */}
      <rect x={5} y={6} width={1} height={1} fill={color} opacity="0.6" />
      <rect x={6} y={7} width={4} height={1} fill={color} opacity="0.4" />
      <rect x={10} y={6} width={1} height={1} fill={color} opacity="0.6" />

      {/* 코 */}
      <rect x={7} y={5} width={1} height={1} fill={skinColor === "#FDBCB4" ? "#e8a99a" : "#b8845a"} opacity="0.6" />

      {/* 목 */}
      <rect x={7} y={8} width={2} height={1} fill={skinColor} />

      {/* 옷 - 상의 */}
      {[5, 6, 7, 8, 9, 10].map((x) => (
        <rect key={`s1${x}`} x={x} y={9} width={1} height={1} fill={shirtColor} />
      ))}
      {[4, 5, 6, 7, 8, 9, 10, 11].map((x) => (
        <rect key={`s2${x}`} x={x} y={10} width={1} height={1} fill={shirtColor} />
      ))}
      {[4, 5, 6, 7, 8, 9, 10, 11].map((x) => (
        <rect key={`s3${x}`} x={x} y={11} width={1} height={1} fill={shirtColor} opacity="0.75" />
      ))}

      {/* 옷 칼라 하이라이트 */}
      <rect x={7} y={9} width={2} height={1} fill="#ffffff" opacity="0.2" />

      {/* 팔 */}
      <rect x={3} y={9} width={1} height={3} fill={skinColor} />
      <rect x={12} y={9} width={1} height={3} fill={skinColor} />

      {/* AI 에이전트 특수 표시 (ai_ 접두사) */}
      {id.startsWith("ai_") && (
        <>
          {/* 안테나 */}
          <rect x={7} y={0} width={1} height={1} fill={color} opacity="0.9" />
          <rect x={8} y={0} width={1} height={1} fill={color} opacity="0.9" />
          <rect x={7} y={1} width={1} height={1} fill={hairColor} />
        </>
      )}
    </svg>
  );
}
