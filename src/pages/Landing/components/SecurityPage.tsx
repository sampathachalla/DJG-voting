import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.15 }
    }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.6, ease: "easeOut" }
    }
};

const pillars = [
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.092 2.019-.273 3m-1.42 4.416a13.917 13.917 0 01-3.618 2.378M15 11a4 4 0 01-8 0" />
        ),
        tag: "Wallet",
        title: "Browser-Local Wallet Creation",
        desc: "The app generates a non-custodial wallet in the browser. The private key is encrypted locally with the user's password before it is stored on the device.",
        bg: "bg-[#e0eff0]",
        tagColor: "bg-teal-100 text-teal-700",
        tagDot: "bg-teal-500",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        ),
        tag: "Encryption",
        title: "Encrypted Local Key Storage",
        desc: "Private keys stay in local browser storage in encrypted form. The current app does not upload signing keys or seed phrases to Firebase or any backend.",
        bg: "bg-[#eedeef]",
        tagColor: "bg-purple-100 text-purple-700",
        tagDot: "bg-purple-500",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        ),
        tag: "Privacy",
        title: "Minimal Firebase Data",
        desc: "Firebase stores only basic profile details such as email and public wallet address. Vote contents and secret wallet material remain outside Firebase.",
        bg: "bg-[#f6f2fa]",
        tagColor: "bg-[#f0e5ff] text-[#7d3bba]",
        tagDot: "bg-[#893ec8]",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        ),
        tag: "Integrity",
        title: "On-Chain Vote Verification",
        desc: "Votes are submitted as Sepolia transactions and can be checked later with the transaction hash or wallet address in a Sepolia block explorer.",
        bg: "bg-[#e9f7f3]",
        tagColor: "bg-emerald-100 text-emerald-700",
        tagDot: "bg-emerald-500",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        ),
        tag: "Infrastructure",
        title: "Sepolia-Only Testing",
        desc: "The app is intentionally limited to Ethereum Sepolia in this phase, so users can validate the contract flow and UI behavior without risking real funds.",
        bg: "bg-[#fdf2f6]",
        tagColor: "bg-rose-100 text-rose-700",
        tagDot: "bg-rose-500",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        ),
        tag: "Governance",
        title: "On-Chain Fee And Treasury Controls",
        desc: "The contract still keeps treasury and fee settings on-chain, while event creation itself is open to connected wallets in the current product flow.",
        bg: "bg-[#f0f4ff]",
        tagColor: "bg-indigo-100 text-indigo-700",
        tagDot: "bg-indigo-500",
    },
];

export default function SecurityPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="min-h-screen bg-white font-sans text-gray-900 pt-24 px-6 md:px-12 pb-24"
        >
            <div className="max-w-[1400px] mx-auto">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="mb-4 inline-flex items-center gap-2 bg-[#e0eff0] text-teal-700 text-sm font-bold px-4 py-2 rounded-full"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Security Model
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="text-4xl md:text-6xl font-black text-[#2e2646] mb-6"
                >
                    How Wallets, Profiles,<br className="hidden md:block" /> and Votes Are Protected
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-xl text-gray-500 mb-16 max-w-3xl"
                >
                    The current implementation uses a simple and explicit model: local wallet custody, minimal Firebase storage, open event creation for connected wallets, and public vote records on Sepolia.
                </motion.p>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {pillars.map((p) => (
                        <motion.div
                            key={p.title}
                            variants={itemVariants}
                            className={`${p.bg} p-8 rounded-3xl border border-transparent hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer`}
                        >
                            <div className={`mb-5 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${p.tagColor}`}>
                                <span className={`w-2 h-2 rounded-full ${p.tagDot}`}></span>
                                {p.tag}
                            </div>
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-5 shadow-sm text-gray-700">
                                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {p.icon}
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-[#2e2646] mb-3">{p.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{p.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </motion.div>
    );
}
