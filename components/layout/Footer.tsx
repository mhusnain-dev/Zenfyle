import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

/*
 * Section 11.8: four columns — Product, Company, Resources, and the wordmark
 * column with tagline + copyright. Contact is a mailto: link (Section 11.2 —
 * no /contact route). No newsletter signup, no social icons.
 *
 * v1.2.0 palette: bg matches header (#102A43 gradient), headings #FFFFFF,
 * links #A8B0B9 → --signal hover, description #8B9AAB, copyright #5E7086,
 * divider white at 8%.
 *
 * The Product column's tool links must come from the tool registry, which is
 * built in Phase 3 — until then it renders no links rather than hardcoding
 * tool names here (Section 12: registry is the single source of truth).
 */

const FOOTER_LINK = "text-footer-link transition-colors hover:text-signal";

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-ink to-ink-deep py-12">
      <PageContainer>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="font-display text-[15px] font-medium text-white">
              Product
            </h2>
            <p className="mt-4 font-body text-[13px] leading-[18px] text-footer-desc">
              Tool links arrive with the tool registry (Phase 3).
            </p>
          </div>
          <div>
            <h2 className="font-display text-[15px] font-medium text-white">
              Company
            </h2>
            <ul className="mt-4 space-y-3 font-body text-[13px]">
              <li>
                <Link href="/privacy" className={FOOTER_LINK}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={FOOTER_LINK}>
                  Terms
                </Link>
              </li>
              <li>
                <a href="mailto:hello@zenfyle.app" className={FOOTER_LINK}>
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-[15px] font-medium text-white">
              Resources
            </h2>
            <ul className="mt-4 space-y-3 font-body text-[13px]">
              <li>
                <Link href="/#faq" className={FOOTER_LINK}>
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-white">
              Zenfyle
            </p>
            <p className="mt-3 font-body text-[13px] leading-[18px] text-footer-desc">
              Every file tool in one workshop.
            </p>
          </div>
        </div>
        <div className="mt-10 border-t border-white/[0.08] pt-6">
          <p className="font-body text-[13px] text-footer-copy">
            © 2026 Zenfyle
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
