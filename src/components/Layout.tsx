import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useWallet } from '../hooks/useWallet';
import { getExplorerAddressUrl } from '../services';
import { hasCustomRpcForNetwork } from '../services/sepoliaService';
import { getContractConfig, getSupportedTestnets } from '../contracts/config';
import { formatTokenAmount } from '../utils/formatAmount';
import type { AppTestnet } from '../types/voting';

type LayoutMode = 'marketing' | 'app';

export default function Layout({ children, mode = 'marketing' }: { children: React.ReactNode; mode?: LayoutMode }) {
    const { walletAddress, walletSource, email, signer, balance, activeNetwork, isCorrectNetwork, setActiveNetwork, refreshWalletState, lockWallet, deleteInternalAccount } = useWallet();
    const isAppMode = mode === 'app';
    const hasCustomRpc = hasCustomRpcForNetwork(activeNetwork);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [drawerActionError, setDrawerActionError] = useState('');
    const { address: contractAddress, networkLabel, nativeTokenSymbol } = getContractConfig(activeNetwork);

    useEffect(() => {
        if (!isAppMode || !walletAddress || !hasCustomRpc) {
            return;
        }

        void refreshWalletState(walletAddress, signer);
    }, [hasCustomRpc, isAppMode, refreshWalletState, signer, walletAddress]);

    const handleDrawerAction = async (): Promise<void> => {
        setDrawerActionError('');

        try {
            if (walletSource === 'metamask') {
                await lockWallet();
                setIsProfileOpen(false);
                return;
            }

            const confirmed = window.confirm(
                'Delete this local account from this browser? This removes the saved wallet from this device. Make sure you have the recovery phrase first.',
            );

            if (!confirmed) {
                return;
            }

            await deleteInternalAccount();
            setIsProfileOpen(false);
        } catch (actionError) {
            setDrawerActionError(actionError instanceof Error ? actionError.message : 'Unable to complete this action.');
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">
            <header className={`sticky top-0 z-50 px-6 md:px-12 ${isAppMode ? 'bg-white/70 backdrop-blur-2xl border-b border-white/30' : 'bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]'} `}>
                <div className="mx-auto flex max-w-[1400px] items-center justify-between py-4">
                <Link to={walletAddress ? "/dashboard" : "/"} className="flex items-center gap-2">
                    <img src={logo} alt="DJG Voting Wallet Logo" className="h-16 w-auto object-contain" />
                    <span className="font-bold text-2xl tracking-tighter text-[#1e1730] mt-1">VOTING</span>
                </Link>

                {isAppMode ? (
                    <div className="hidden lg:flex items-center gap-6">
                        <nav className="flex items-center gap-8 text-[0.78rem] font-bold tracking-[0.18em] text-[#514769]">
                            <Link to="/dashboard" className="hover:text-[#7d3bba] transition-colors">DASHBOARD</Link>
                            <Link to="/events" className="hover:text-[#7d3bba] transition-colors">EVENTS</Link>
                            <Link to="/events/new" className="hover:text-[#7d3bba] transition-colors">CREATE</Link>
                        </nav>
                        {walletAddress ? (
                            <div className="rounded-full border border-white/40 bg-white/55 px-4 py-2 text-right shadow-[0_10px_24px_rgba(46,38,70,0.08)] backdrop-blur-xl">
                                <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-[#6a6284]">{networkLabel} balance</p>
                                <p className="mt-1 text-sm font-bold text-[#2e2646]">{`${formatTokenAmount(balance)} ${nativeTokenSymbol}`}</p>
                            </div>
                        ) : null}
                        {walletAddress ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsProfileOpen((current) => !current)}
                                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8b46cd] text-sm font-black text-white shadow-[0_14px_30px_rgba(125,59,186,0.28)] transition hover:bg-[#722eaa]"
                                >
                                    {email?.[0]?.toUpperCase() ?? walletAddress.slice(2, 3).toUpperCase()}
                                </button>
                                <div className={`fixed inset-0 z-[55] bg-[#2e2646]/18 backdrop-blur-[2px] transition ${isProfileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setIsProfileOpen(false)} />
                                <div className={`fixed inset-y-0 right-0 z-[60] flex h-screen w-[20vw] min-w-[320px] max-w-[420px] flex-col border-l border-white/40 bg-white/82 p-6 shadow-[-30px_0_80px_rgba(46,38,70,0.16)] backdrop-blur-2xl transition duration-200 ${isProfileOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'}`}>
                                    <div className="flex h-full flex-col">
                                        <div className="border-b border-[#e7e0f1] pb-6">
                                            <button
                                                type="button"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e7e0f1] bg-white/80 px-4 py-2 text-sm font-bold text-[#514769] transition hover:border-purple-300 hover:text-[#7d3bba]"
                                            >
                                                <span className="text-base leading-none">←</span>
                                                <span>Back</span>
                                            </button>
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8b46cd] text-xl font-black text-white shadow-[0_14px_30px_rgba(125,59,186,0.22)]">
                                                    {email?.[0]?.toUpperCase() ?? walletAddress.slice(2, 3).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-base font-semibold text-[#2e2646]">{email ?? "Wallet session"}</p>
                                                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[#6a6284]">{walletSource ?? "Connected wallet"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-5 overflow-y-auto pr-1 text-sm">
                                            <DrawerSection title="Current session">
                                                <div className="space-y-4">
                                                    <DrawerRow label="Email" value={email ?? "MetaMask session"} />
                                                    <DrawerRow label="Can create event" value="Yes" />
                                                    <DrawerRow label="Contract address" value={contractAddress || `Add the ${networkLabel} contract address in .env`} />
                                                    <div>
                                                        <p className="text-[0.68rem] uppercase tracking-[0.28em] text-[#6a6284]">Active network</p>
                                                        <select
                                                            value={activeNetwork}
                                                            onChange={(event) => void setActiveNetwork(event.target.value as AppTestnet)}
                                                            className="mt-2 w-full rounded-2xl border border-[#e7e0f1] bg-white/90 px-3 py-3 font-semibold text-[#2e2646] outline-none transition focus:border-purple-300"
                                                        >
                                                            {getSupportedTestnets().map((network) => (
                                                                <option key={network} value={network}>
                                                                    {getContractConfig(network).networkLabel}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </DrawerSection>

                                            <DrawerSection title="Wallet address">
                                                <DropdownRow label="Explorer" value={walletAddress} href={getExplorerAddressUrl(walletAddress, activeNetwork)} />
                                            </DrawerSection>

                                            <DrawerSection title="Wallet details">
                                                <div className="space-y-4">
                                                    <DrawerRow label={`${networkLabel} balance`} value={`${formatTokenAmount(balance)} ${nativeTokenSymbol}`} />
                                                    <DrawerRow label="Network" value={isCorrectNetwork ? networkLabel : `Switch to ${networkLabel}`} />
                                                    <DrawerRow label="Session type" value={walletSource ?? "Connected wallet"} />
                                                </div>
                                            </DrawerSection>
                                        </div>

                                        {drawerActionError ? (
                                            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                {drawerActionError}
                                            </p>
                                        ) : null}

                                        <div className="mt-6 space-y-3">
                                            <button
                                                onClick={() => {
                                                    setDrawerActionError('');
                                                    void lockWallet().then(() => setIsProfileOpen(false));
                                                }}
                                                className="w-full rounded-full bg-[#8b46cd] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/25 transition hover:bg-[#722eaa]"
                                            >
                                                Logout
                                            </button>
                                            <button
                                                onClick={() => void handleDrawerAction()}
                                                className="w-full rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50"
                                            >
                                                {walletSource === 'metamask' ? 'Disconnect MetaMask' : 'Delete account'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <nav className="hidden lg:flex items-center gap-10 text-[0.85rem] font-bold tracking-[0.15em] text-[#333]">
                        <Link to="/features" className="hover:text-[#7d3bba] transition-colors">FEATURES</Link>
                        <Link to="/security" className="hover:text-[#7d3bba] transition-colors">SECURITY</Link>
                        <Link to="/support" className="hover:text-[#7d3bba] transition-colors">SUPPORT</Link>
                        <Link to={walletAddress ? "/dashboard" : "/login"} className="bg-[#8b46cd] hover:bg-[#722eaa] text-white px-8 py-3.5 rounded-full transition-colors ml-4 shadow-lg shadow-purple-600/30">
                            {walletAddress ? "DASHBOARD" : "GET STARTED"}
                        </Link>
                    </nav>
                )}

                <button className="lg:hidden text-gray-800 p-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                </div>
            </header>

            <main className="flex-grow">
                {isAppMode && !hasCustomRpc ? (
                    <div className="px-6 pt-6 md:px-12">
                        <div className="mx-auto max-w-[1400px] rounded-[1.5rem] border border-amber-200 bg-amber-50/95 px-5 py-4 text-sm text-amber-900 shadow-[0_18px_50px_rgba(120,83,24,0.08)] backdrop-blur-xl">
                                <p className="font-semibold">RPC not configured.</p>
                                <p className="mt-1">
                                Add the RPC URL for {networkLabel} to your <code>.env</code> file to load balance and contract status without public rate limits.
                                </p>
                            </div>
                        </div>
                ) : null}
                {children}
            </main>

            {isAppMode ? null : <footer className="bg-[#1e1730] text-gray-300 py-16 px-6 md:px-12 border-t-[8px] border-[#7d3bba] mt-auto">
                <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2">
                        <img src={logo} alt="DJG Voting Wallet Logo" className="h-16 w-auto object-contain brightness-0 invert" />
                        <span className="font-bold text-2xl ml-1 text-white mt-1">VOTING</span>
                    </div>

                    <div className="flex flex-wrap justify-center gap-8 font-medium">
                        <Link to="#" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="#" className="hover:text-white transition-colors">Terms</Link>
                        <Link to="/security" className="hover:text-white transition-colors">Security</Link>
                        <a href="#" className="hover:text-white transition-colors">Github</a>
                        <a href="#" className="hover:text-white transition-colors">Twitter X</a>
                    </div>

                    <p className="text-sm">© 2026 DJG Voting Wallet.</p>
                </div>
            </footer>}
        </div>
    );
}

function DropdownRow({ label, value, href }: { label: string; value: string; href?: string }) {
    const content = (
        <div>
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-[#6a6284]">{label}</p>
            <p className="mt-1 break-all font-semibold leading-6 text-[#2e2646]">{value}</p>
        </div>
    );

    return href ? <a href={href} target="_blank" rel="noreferrer" className="block transition hover:text-[#7d3bba]">{content}</a> : content;
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-[1.5rem] border border-[#ece6f5] bg-white/75 p-4 shadow-[0_12px_32px_rgba(46,38,70,0.06)]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#6a6284]">{title}</p>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-[#6a6284]">{label}</p>
            <p className="mt-1 break-all font-semibold leading-6 text-[#2e2646]">{value}</p>
        </div>
    );
}
