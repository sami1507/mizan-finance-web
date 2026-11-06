import Link from "next/link";
export function Brand({ light = false }: { light?: boolean }) { return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Mizan Finance — الرئيسية"><span className="brand-mark">m<span>·</span></span><span className="brand-word">ميزان<small>MIZAN FINANCE</small></span></Link>; }
