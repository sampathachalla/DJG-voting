import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function LandingPage() {
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2 }
        }
    };

    const cardVariants: Variants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    return (
        <div>
            {/* Hero Section */}
            <main>
                {/* Background Area imitating a bright, high-tech circuit background */}
                <section className="relative w-full min-h-[650px] flex items-center justify-center overflow-hidden bg-[#e0eff0]">
                    {/* Abstract fluid gradient in the background */}
                    <div className="absolute inset-0" style={{
                        background: 'linear-gradient(135deg, #dceef4 0%, #b8cde4 25%, #cbcae4 70%, #9fcce1 100%)'
                    }}></div>

                    <div className="absolute top-[-100px] left-[-200px] w-[800px] h-[800px] bg-purple-300 rounded-full blur-[120px] opacity-40 mix-blend-multiply pointer-events-none"></div>
                    <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-teal-200 rounded-full blur-[100px] opacity-60 mix-blend-multiply pointer-events-none"></div>

                    {/* Circuit Grid Decoration */}
                    <div className="absolute inset-0 opacity-15" style={{
                        backgroundImage: `linear-gradient(#4d5a8c 1px, transparent 1px), linear-gradient(90deg, #4d5a8c 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }}></div>

                    <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                        {/* Tech paths resembling circuits */}
                        <path d="M 0 120 L 120 120 L 160 80 L 100vw 80" stroke="#35294a" strokeWidth="4" fill="none" />
                        <circle cx="120" cy="120" r="5" fill="#35294a" /> <circle cx="160" cy="80" r="5" fill="#35294a" />
                        <path d="M 30vw 100vh L 30vw 300 L 25vw 250 L 0 250" stroke="#7d3bba" strokeWidth="6" fill="none" />
                        <circle cx="30vw" cy="300" r="7" fill="#7d3bba" /> <circle cx="25vw" cy="250" r="7" fill="#7d3bba" />
                        <path d="M 100vw 60vh L 70vw 60vh L 65vw 55vh L 65vw 0" stroke="#37a7bd" strokeWidth="5" fill="none" />
                        <circle cx="70vw" cy="60vh" r="6" fill="#37a7bd" /> <circle cx="65vw" cy="55vh" r="6" fill="#37a7bd" />
                        <path d="M 50vw 100vh L 50vw 80vh L 60vw 70vh L 100vw 70vh" stroke="#35294a" strokeWidth="3" fill="none" />
                    </svg>

                    {/* Hero Content aligned like the image */}
                    <div className="relative z-10 max-w-[1400px] mx-auto w-full px-6 md:px-12 flex flex-col items-center text-center justify-center pt-8 pb-16">
                        <motion.h1
                            initial={{ opacity: 0, y: -30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="text-[3.5rem] md:text-[6rem] lg:text-[7.5rem] leading-[0.9] font-black text-[#2e2646] tracking-tighter max-w-6xl">
                            SEPOLIA VOTING<br />WITH A LOCAL<br />NON-CUSTODIAL WALLET
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                            className="mt-8 text-xl md:text-[1.35rem] text-[#2c223f] font-semibold max-w-4xl leading-relaxed py-2 md:py-0 px-4 md:px-0">
                            Create a wallet in your browser, store only your public profile in Firebase, and cast verifiable votes on Ethereum Sepolia without paying real money.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                            className="mt-12 flex items-center justify-center">
                            <Link
                                to="/login"
                                className="bg-[#8b46cd] hover:bg-[#722eaa] text-white font-bold py-4 px-12 rounded-full text-lg shadow-xl shadow-purple-600/40 transition-transform hover:scale-105 active:scale-95 inline-block"
                            >
                                Open The Voting App
                            </Link>
                        </motion.div>
                    </div>
                </section>

                {/* Minimal Feature Section to complete the "Landing Page" feel */}
                <section className="py-24 bg-white px-6 md:px-12 overflow-hidden">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        className="max-w-[1400px] mx-auto grid md:grid-cols-3 gap-12 text-center md:text-left">
                        <motion.div variants={cardVariants} className="p-8 rounded-3xl group hover:bg-[#f6f2fa] transition-colors duration-300 border border-transparent hover:border-purple-100 hover:shadow-xl hover:shadow-purple-500/5 cursor-pointer hover:-translate-y-2 transform transition-transform">
                            <div className="w-16 h-16 bg-[#eedeef] text-[#7d3bba] rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black text-[#2e2646] mb-4">Local Key Ownership</h3>
                            <p className="text-gray-600 leading-relaxed text-lg">
                                Your wallet is created on your device and encrypted with your password. Private keys never need to leave the browser.
                            </p>
                        </motion.div>

                        <motion.div variants={cardVariants} className="p-8 rounded-3xl group hover:bg-[#f6f2fa] transition-colors duration-300 border border-transparent hover:border-purple-100 hover:shadow-xl hover:shadow-purple-500/5 cursor-pointer hover:-translate-y-2 transform transition-transform">
                            <div className="w-16 h-16 bg-[#eedeef] text-[#7d3bba] rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black text-[#2e2646] mb-4">Sepolia Testnet Only</h3>
                            <p className="text-gray-600 leading-relaxed text-lg">
                                Every event, proposal, and vote is written to Ethereum Sepolia so you can test the full flow without spending real money.
                            </p>
                        </motion.div>

                        <motion.div variants={cardVariants} className="p-8 rounded-3xl group hover:bg-[#f6f2fa] transition-colors duration-300 border border-transparent hover:border-purple-100 hover:shadow-xl hover:shadow-purple-500/5 cursor-pointer hover:-translate-y-2 transform transition-transform">
                            <div className="w-16 h-16 bg-[#eedeef] text-[#7d3bba] rounded-2xl flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-black text-[#2e2646] mb-4">Public Vote Verification</h3>
                            <p className="text-gray-600 leading-relaxed text-lg">
                                Each vote is stored on-chain with a transaction hash, making results easy to verify later through a Sepolia block explorer.
                            </p>
                        </motion.div>
                    </motion.div>
                </section>
            </main>
        </div>
    );
}
