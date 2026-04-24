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
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" }
    }
};

const features = [
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        ),
        title: "Tamper-Proof Voting",
        desc: "Every vote is signed by the connected wallet and stored on Ethereum Sepolia. Once confirmed, the record stays on-chain for later verification.",
        bg: "bg-[#f6f2fa]",
        hoverBorder: "hover:border-[#893ec8]/30",
        hoverShadow: "hover:shadow-[#893ec8]/10",
        iconColor: "text-[#893ec8]",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        ),
        title: "Sepolia Testnet Workflow",
        desc: "The current release is intentionally limited to Ethereum Sepolia so you can test wallet creation, event creation, and voting without spending real funds.",
        bg: "bg-[#e0eff0]",
        hoverBorder: "hover:border-teal-300",
        hoverShadow: "hover:shadow-teal-500/10",
        iconColor: "text-teal-600",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        ),
        title: "Open Event Creation",
        desc: "Any connected wallet can create a voting event on Sepolia, making it easy to test proposal creation and voter participation without an admin gate.",
        bg: "bg-[#eedeef]",
        hoverBorder: "hover:border-purple-300",
        hoverShadow: "hover:shadow-purple-500/10",
        iconColor: "text-purple-600",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        ),
        title: "Optional MetaMask Access",
        desc: "The app can create a local wallet for voters, but users can also connect MetaMask when they want to transact with an external wallet.",
        bg: "bg-[#f0eaf3]",
        hoverBorder: "hover:border-indigo-300",
        hoverShadow: "hover:shadow-indigo-500/10",
        iconColor: "text-indigo-600",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        ),
        title: "Flexible Voting Modes",
        desc: "A single contract supports simple ballots, multi-proposal events, and proposal-based voting so the UI can handle several election styles in one flow.",
        bg: "bg-[#e5f5f5]",
        hoverBorder: "hover:border-cyan-300",
        hoverShadow: "hover:shadow-cyan-500/10",
        iconColor: "text-cyan-600",
    },
    {
        icon: (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        ),
        title: "Minimal Firebase Profiles",
        desc: "Firebase is used only to store basic user profile data like email and public wallet address. Private keys, seed phrases, and votes are not stored there.",
        bg: "bg-[#fdf2f6]",
        hoverBorder: "hover:border-pink-300",
        hoverShadow: "hover:shadow-pink-500/10",
        iconColor: "text-pink-600",
    },
];

export default function FeaturesPage() {
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
                    className="mb-4 inline-flex items-center gap-2 bg-[#f6f2fa] text-[#7d3bba] text-sm font-bold px-4 py-2 rounded-full"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Product Features
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="text-4xl md:text-6xl font-black text-[#2e2646] mb-6"
                >
                    What This Voting App<br className="hidden md:block" /> Actually Does Today
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-xl text-gray-500 mb-16 max-w-3xl"
                >
                    This build focuses on a practical first version: browser wallet creation, Sepolia-backed voting events, public vote verification, and lightweight Firebase profile storage.
                </motion.p>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {features.map((f) => (
                        <motion.div
                            key={f.title}
                            variants={itemVariants}
                            className={`${f.bg} p-8 rounded-3xl border border-transparent ${f.hoverBorder} hover:shadow-xl ${f.hoverShadow} transition-all duration-300 transform hover:-translate-y-2 cursor-pointer`}
                        >
                            <div className={`w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm ${f.iconColor}`}>
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {f.icon}
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-[#2e2646] mb-3">{f.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </motion.div>
    );
}
