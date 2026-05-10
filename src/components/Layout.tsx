import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useWallet } from '../hooks/useWallet';
import { hasCustomRpcForNetwork } from '../services/sepoliaService';
import { getContractConfig } from '../contracts/config';
import WalletRail from './WalletRail';

type LayoutMode = 'marketing' | 'app';

export default function Layout({ children, mode = 'marketing' }: { children: React.ReactNode; mode?: LayoutMode }) {
    const location = useLocation();
    const { walletAddress, signer, activeNetwork, refreshWalletState } = useWallet();
    const isAppShell = mode === 'app';
    const hasCustomRpc = hasCustomRpcForNetwork(activeNetwork);
    const [isWalletRailOpen, setIsWalletRailOpen] = useState(false);
    const { networkLabel } = getContractConfig(activeNetwork);

    const pathname = location.pathname;
    const isVoteArea = pathname.startsWith('/vote');
    const isOrganizeArea = pathname.startsWith('/organize');
    const isObserveArea = pathname.startsWith('/observe');

    useEffect(() => {
        if (!isAppShell || !walletAddress || !hasCustomRpc) {
            return;
        }

        void refreshWalletState(walletAddress, signer);
    }, [hasCustomRpc, isAppShell, refreshWalletState, signer, walletAddress]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (window.matchMedia('(min-width: 1024px)').matches) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setIsWalletRailOpen(true);
            /* eslint-enable react-hooks/set-state-in-effect */
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        // Close the mobile overlay on navigate; desktop width stays user-controlled.
        if (window.matchMedia('(max-width: 1023px)').matches) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setIsWalletRailOpen(false);
            /* eslint-enable react-hooks/set-state-in-effect */
        }
    }, [pathname]);

    const modeTabClass = (active: boolean): string =>
        `rounded-full px-3 py-1.5 text-[0.7rem] font-bold tracking-[0.1em] transition ${
            active ? 'bg-[#8b46cd] text-white shadow-sm shadow-purple-600/15' : 'text-[#514769] hover:text-[#7d3bba]'
        }`;

    return (
        <div
            className={`bg-white font-sans text-gray-900 flex flex-col ${
                isAppShell ? 'h-screen min-h-0 overflow-hidden' : 'min-h-screen'
            }`}
        >
            <header
                className={`shrink-0 sticky top-0 z-50 px-4 md:px-6 ${
                    isAppShell ? 'bg-white/80 backdrop-blur-xl border-b border-[#e7e0f1]/80' : 'bg-white shadow-[0_1px_8px_-2px_rgba(46,38,70,0.06)]'
                } `}
            >
                <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 py-3">
                <Link to={walletAddress ? "/vote" : "/"} className="flex items-center gap-3">
                    <img src={logo} alt="Vera Talley voting wallet" className="h-12 w-auto object-contain" />
                    {isAppShell ? (
                        <div className="flex flex-col leading-tight">
                            <span className="font-black text-xl tracking-tight text-[#1e1730]">Vera Talley</span>
                            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-[#7d3bba]">Voting suite</span>
                        </div>
                    ) : (
                        <div className="flex flex-col leading-tight">
                            <span className="font-black text-xl tracking-tight text-[#1e1730]">Vera Talley</span>
                            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.32em] text-[#6a6284]">By DoJaGa</span>
                        </div>
                    )}
                </Link>

                {isAppShell ? (
                    <div className="flex flex-1 flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-end">
                        <nav className="order-last flex w-full justify-center lg:order-none lg:w-auto lg:justify-start">
                            <div className="inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full border border-[#e7e0f1] bg-white/70 p-0.5 shadow-sm backdrop-blur-md">
                                <NavLink to="/vote" className={() => modeTabClass(isVoteArea)}>
                                    VOTE
                                </NavLink>
                                <NavLink to="/organize/events/new" className={() => modeTabClass(isOrganizeArea)}>
                                    ORGANIZE
                                </NavLink>
                                <NavLink to="/observe" className={() => modeTabClass(isObserveArea)}>
                                    OBSERVE
                                </NavLink>
                            </div>
                        </nav>
                        <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3">
                            <button
                                type="button"
                                onClick={() => setIsWalletRailOpen((current) => !current)}
                                className="rounded-full border border-[#e7e0f1] bg-white/90 px-3 py-2 text-[0.7rem] font-bold tracking-[0.12em] text-[#514769] shadow-sm transition hover:border-purple-300 hover:text-[#7d3bba]"
                                aria-expanded={isWalletRailOpen}
                                aria-controls="wallet-rail-panel"
                            >
                                {isWalletRailOpen ? 'HIDE WALLET' : 'WALLET'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <nav className="hidden lg:flex items-center gap-10 text-[0.85rem] font-bold tracking-[0.15em] text-[#333]">
                        <Link to="/features" className="hover:text-[#7d3bba] transition-colors">FEATURES</Link>
                        <Link to="/security" className="hover:text-[#7d3bba] transition-colors">SECURITY</Link>
                        <Link to="/support" className="hover:text-[#7d3bba] transition-colors">SUPPORT</Link>
                        <Link to={walletAddress ? "/vote" : "/login"} className="bg-[#8b46cd] hover:bg-[#722eaa] text-white px-8 py-3.5 rounded-full transition-colors ml-4 shadow-lg shadow-purple-600/30">
                            {walletAddress ? "OPEN APP" : "GET STARTED"}
                        </Link>
                    </nav>
                )}

                <button type="button" className="lg:hidden text-gray-800 p-2" aria-label="Menu">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                </div>
            </header>

            {isAppShell ? (
                <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-[#eef4f7] via-[#f0eaf8] to-[#e6f0f4]">
                    {!hasCustomRpc ? (
                        <div className="px-4 pt-3 md:px-5">
                            <div className="mx-auto max-w-[1600px] rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-sm backdrop-blur-md">
                                <p className="font-semibold">RPC not configured.</p>
                                <p className="mt-1">
                                    Add the RPC URL for {networkLabel} to your <code>.env</code> file to load balance and contract status without public rate limits.
                                </p>
                            </div>
                        </div>
                    ) : null}

                    <div
                        className={`relative mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-3 px-4 py-3 md:px-5 lg:flex-row lg:items-stretch lg:gap-5 lg:px-5 lg:py-4 lg:overflow-hidden ${
                            isWalletRailOpen ? 'lg:justify-between' : ''
                        }`}
                    >
                        {isWalletRailOpen ? (
                            <div
                                className="fixed inset-0 z-[35] bg-[#2e2646]/18 backdrop-blur-[2px] transition lg:hidden"
                                onClick={() => setIsWalletRailOpen(false)}
                                aria-hidden
                            />
                        ) : null}
                        <main
                            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[max-width] duration-300 ease-out ${
                                isWalletRailOpen
                                    ? 'lg:max-w-[min(56rem,calc(100%-22rem))] lg:flex-[1_1_auto] lg:shrink'
                                    : 'lg:max-w-none'
                            }`}
                        >
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-white/50 bg-gradient-to-br from-[#eef4f7] via-[#f0eaf8] to-[#e6f0f4] shadow-md shadow-[rgba(46,38,70,0.08)] backdrop-blur-xl [-webkit-overflow-scrolling:touch]">
                                <div className="flex min-h-full min-w-0 flex-col">{children}</div>
                            </div>
                        </main>
                        <div
                            id="wallet-rail-panel"
                            className={`flex min-h-0 min-w-0 flex-col overscroll-contain transition-[width,max-width,opacity] duration-300 ease-out [-webkit-overflow-scrolling:touch] lg:shrink-0 ${
                                isWalletRailOpen
                                    ? 'fixed inset-y-0 right-0 z-40 w-full max-w-[360px] overflow-y-auto border-l border-[#e7e0f1] bg-white/95 shadow-lg backdrop-blur-xl lg:relative lg:inset-auto lg:right-auto lg:z-auto lg:w-[340px] lg:max-w-[360px] lg:border-0 lg:bg-transparent lg:shadow-none lg:opacity-100 lg:pointer-events-auto'
                                    : 'hidden overflow-hidden lg:flex lg:w-0 lg:max-w-0 lg:overflow-hidden lg:border-0 lg:bg-transparent lg:opacity-0 lg:pointer-events-none lg:shadow-none'
                            }`}
                        >
                            <div className="min-h-0 min-w-0 p-3 lg:p-0">
                                <WalletRail />
                            </div>
                        </div>
                    </div>

                    <footer className="shrink-0 border-t border-[#e7e0f1]/80 bg-white/70 px-4 py-2 text-center text-[0.65rem] uppercase tracking-[0.24em] text-[#6a6284] backdrop-blur-md md:px-8">
                        Vera Talley · operated by DoJaGa · on-chain voting on Sepolia
                    </footer>
                </div>
            ) : (
                <main className="flex-grow">{children}</main>
            )}

            {isAppShell ? null : <footer className="bg-[#1e1730] text-gray-300 py-16 px-6 md:px-12 border-t-[8px] border-[#7d3bba] mt-auto">
                <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="Vera Talley voting wallet" className="h-14 w-auto object-contain brightness-0 invert" />
                        <div className="flex flex-col leading-tight">
                            <span className="font-black text-xl text-white">Vera Talley</span>
                            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-gray-400">By DoJaGa</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-8 font-medium">
                        <Link to="#" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="#" className="hover:text-white transition-colors">Terms</Link>
                        <Link to="/security" className="hover:text-white transition-colors">Security</Link>
                        <a href="#" className="hover:text-white transition-colors">Github</a>
                        <a href="#" className="hover:text-white transition-colors">Twitter X</a>
                    </div>

                    <p className="text-sm">© 2026 DoJaGa · Vera Talley.</p>
                </div>
            </footer>}
        </div>
    );
}
