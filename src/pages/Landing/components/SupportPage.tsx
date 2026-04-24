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

const faqs = [
    {
        q: "Does this app use real Ethereum money?",
        a: "No. The current version writes only to Ethereum Sepolia, which is a testnet. Users need Sepolia test ETH for gas, but that can be obtained from a faucet and has no real-money value."
    },
    {
        q: "What happens during signup?",
        a: "Signup creates a non-custodial Ethereum wallet in the browser, encrypts the private key with the chosen password, stores the encrypted key locally, and saves only the email and public wallet address to Firebase."
    },
    {
        q: "Is my vote anonymous?",
        a: "Votes are public on-chain and linked to the wallet address used to cast them. The app does not store the vote in Firebase, but anyone inspecting Sepolia can see which wallet voted for which option."
    },
    {
        q: "Can DJG cancel or change my vote?",
        a: "No. Once the vote transaction is confirmed on Sepolia, it becomes part of the blockchain record. The app cannot edit, cancel, or rewrite an already confirmed vote."
    },
    {
        q: "Can any wallet create a voting event?",
        a: "Not by default. The contract owner must approve a wallet as a creator before it can open a voting event. This prevents arbitrary event creation from every connected wallet."
    },
    {
        q: "What wallet options are supported right now?",
        a: "The app supports an internal browser-created wallet as the primary flow and MetaMask as an optional connected wallet. Importing seed phrases and hardware wallets is not part of the current implementation."
    },
];

export default function SupportPage() {
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Help Centre
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.15 }}
                    className="text-4xl md:text-6xl font-black text-[#2e2646] mb-6"
                >
                    Voting App Questions,<br className="hidden md:block" /> Answered.
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-xl text-gray-500 mb-16 max-w-3xl"
                >
                    These answers match the current product: Sepolia-only voting, local wallet custody, optional MetaMask, and minimal Firebase profile storage.
                </motion.p>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid lg:grid-cols-2 gap-16"
                >
                    {/* FAQs */}
                    <motion.div variants={itemVariants}>
                        <h2 className="text-2xl font-bold mb-8 text-[#2e2646] flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-[#f6f2fa] flex items-center justify-center text-[#893ec8]">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </span>
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-4">
                            {faqs.map((faq) => (
                                <details key={faq.q} className="group border border-gray-100 bg-gray-50 rounded-2xl p-6 open:bg-white open:shadow-lg open:shadow-purple-500/5 transition-all duration-300 cursor-pointer hover:border-purple-200">
                                    <summary className="font-semibold text-base cursor-pointer flex justify-between items-center text-[#2e2646] list-none">
                                        {faq.q}
                                        <span className="text-[#893ec8] shrink-0 ml-4 group-open:rotate-180 transition-transform duration-300">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </span>
                                    </summary>
                                    <p className="mt-4 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                                        {faq.a}
                                    </p>
                                </details>
                            ))}
                        </div>
                    </motion.div>

                    {/* Contact form */}
                    <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#f6f2fa] to-white p-10 rounded-3xl border border-purple-100 shadow-xl shadow-purple-900/5 h-fit">
                        <h2 className="text-2xl font-bold mb-2 text-[#2e2646]">Need setup help?</h2>
                        <p className="text-gray-500 mb-8">Use this form area as a placeholder for support. In the current build it is presentational only and does not submit anywhere.</p>

                        <form className="flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Email</label>
                                <input
                                    type="email"
                                    placeholder="voter@example.com"
                                    className="w-full px-5 py-3.5 rounded-xl border border-purple-200 bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-[#893ec8] transition-all shadow-sm text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Topic</label>
                                <select className="w-full px-5 py-3.5 rounded-xl border border-purple-200 bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-[#893ec8] transition-all shadow-sm text-sm text-gray-600">
                                    <option>Select a topic…</option>
                                    <option>Wallet setup</option>
                                    <option>Sepolia funding</option>
                                    <option>Event creation</option>
                                    <option>Voting verification</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Message</label>
                                <textarea
                                    placeholder="Describe the issue you are seeing in the current app…"
                                    rows={5}
                                    className="w-full px-5 py-3.5 rounded-xl border border-purple-200 bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-[#893ec8] transition-all shadow-sm resize-none text-sm"
                                ></textarea>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                className="bg-[#8b46cd] hover:bg-[#722eaa] text-white font-bold py-4 px-8 rounded-xl transition-colors shadow-lg shadow-purple-600/30 mt-1"
                            >
                                Placeholder Support Form
                            </motion.button>
                        </form>
                    </motion.div>
                </motion.div>
            </div>
        </motion.div>
    );
}
