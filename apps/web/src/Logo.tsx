export function Logo({ size = 32 }: { readonly size?: number }) {
  return (
    <div className="logo">
      <img className="logoIcon" src="/app-icon.png" alt="" width={size} height={size} />
      <span className="logoText" style={{ fontSize: size * 0.55 }}>Sleeve</span>
    </div>
  )
}
