
const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <main className="flex-1">
        {/* Hero Section with Delivery Image */}
        <section className="relative overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-blue-900/20"></div>
          <div className="absolute inset-0">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-500/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-500/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-4000"></div>
          </div>
          
          <div className="relative w-full">
            <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
              <main className="mt-10 w-full px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
                <div className="sm:text-center lg:text-left">
                  <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl animate-fade-in">
                    <span className="block xl:inline animate-slide-in-left">Complete Trucking</span>{' '}
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 xl:inline animate-slide-in-right">Business Management</span>
                  </h1>
                  <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0 animate-fade-in-up animation-delay-300">
                    Take full control of your third-party trucking business with Routico's comprehensive platform. 
                    Manage drivers, create orders, track operations, and grow your logistics enterprise.
                  </p>
                  <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start animate-fade-in-up animation-delay-500">
                    <div className="rounded-md shadow-lg">
                      <a
                        href="/register"
                        className="group w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 hover:shadow-xl md:py-4 md:text-lg md:px-10"
                      >
                        <span className="group-hover:animate-bounce">Apply Now</span>
                      </a>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-3">
                      <a
                        href="#pricing"
                        className="w-full flex items-center justify-center px-8 py-3 border border-gray-600 text-base font-medium rounded-md text-gray-300 bg-gray-700/50 hover:bg-gray-600/70 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm md:py-4 md:text-lg md:px-10"
                      >
                        View Pricing
                      </a>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
          
          {/* Delivery Image with Animation */}
          <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
            <div className="h-56 w-full sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
              <svg
                className="h-full w-full object-contain relative z-10 animate-float"
                viewBox="0 0 800 600"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="Delivery Service"
              >
                {/* Road */}
                <rect x="0" y="420" width="800" height="60" rx="8" fill="#1e293b" />
                <line x1="50" y1="450" x2="130" y2="450" stroke="#94a3b8" strokeWidth="3" strokeDasharray="12 8" />
                <line x1="180" y1="450" x2="260" y2="450" stroke="#94a3b8" strokeWidth="3" strokeDasharray="12 8" />
                <line x1="310" y1="450" x2="390" y2="450" stroke="#94a3b8" strokeWidth="3" strokeDasharray="12 8" />
                <line x1="440" y1="450" x2="520" y2="450" stroke="#94a3b8" strokeWidth="3" strokeDasharray="12 8" />
                <line x1="570" y1="450" x2="650" y2="450" stroke="#94a3b8" strokeWidth="3" strokeDasharray="12 8" />
                <line x1="700" y1="450" x2="780" y2="450" stroke="#94a3b8" strokeWidth="3" strokeDasharray="12 8" />

                {/* Truck Body */}
                <rect x="250" y="280" width="280" height="140" rx="12" fill="#3b82f6" />
                <rect x="260" y="290" width="260" height="120" rx="8" fill="#2563eb" />
                {/* Cargo lines */}
                <rect x="280" y="310" width="80" height="8" rx="4" fill="#60a5fa" opacity="0.6" />
                <rect x="280" y="330" width="60" height="8" rx="4" fill="#60a5fa" opacity="0.4" />
                <rect x="280" y="350" width="70" height="8" rx="4" fill="#60a5fa" opacity="0.5" />
                {/* Package icon on truck */}
                <rect x="420" y="310" width="70" height="70" rx="8" fill="#f59e0b" />
                <line x1="455" y1="310" x2="455" y2="380" stroke="#d97706" strokeWidth="2" />
                <line x1="420" y1="345" x2="490" y2="345" stroke="#d97706" strokeWidth="2" />

                {/* Cabin */}
                <rect x="530" y="310" width="120" height="110" rx="12" fill="#1d4ed8" />
                <rect x="545" y="325" width="55" height="50" rx="8" fill="#93c5fd" opacity="0.7" />
                <rect x="610" y="360" width="30" height="50" rx="4" fill="#1e40af" />

                {/* Wheels */}
                <circle cx="340" cy="425" r="32" fill="#334155" />
                <circle cx="340" cy="425" r="20" fill="#64748b" />
                <circle cx="340" cy="425" r="8" fill="#94a3b8" />
                <circle cx="580" cy="425" r="32" fill="#334155" />
                <circle cx="580" cy="425" r="20" fill="#64748b" />
                <circle cx="580" cy="425" r="8" fill="#94a3b8" />

                {/* Location Pin */}
                <g transform="translate(160, 140)">
                  <path d="M30 0C13.4 0 0 13.4 0 30c0 22.5 30 50 30 50s30-27.5 30-50C60 13.4 46.6 0 30 0z" fill="#ef4444" />
                  <circle cx="30" cy="28" r="12" fill="#fca5a5" />
                </g>

                {/* Route dots */}
                <circle cx="220" cy="220" r="5" fill="#60a5fa" opacity="0.6" />
                <circle cx="240" cy="240" r="4" fill="#60a5fa" opacity="0.5" />
                <circle cx="255" cy="260" r="3" fill="#60a5fa" opacity="0.4" />

                {/* Speed lines */}
                <line x1="180" y1="340" x2="230" y2="340" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
                <line x1="160" y1="360" x2="230" y2="360" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
                <line x1="190" y1="380" x2="230" y2="380" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" opacity="0.3" />

                {/* Small floating packages */}
                <g transform="translate(620, 180) rotate(-15)">
                  <rect width="40" height="40" rx="6" fill="#f59e0b" opacity="0.8" />
                  <line x1="20" y1="0" x2="20" y2="40" stroke="#d97706" strokeWidth="1.5" />
                  <line x1="0" y1="20" x2="40" y2="20" stroke="#d97706" strokeWidth="1.5" />
                </g>
                <g transform="translate(680, 240) rotate(10)">
                  <rect width="30" height="30" rx="5" fill="#f59e0b" opacity="0.6" />
                  <line x1="15" y1="0" x2="15" y2="30" stroke="#d97706" strokeWidth="1.5" />
                  <line x1="0" y1="15" x2="30" y2="15" stroke="#d97706" strokeWidth="1.5" />
                </g>
              </svg>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-800/50 to-gray-800"></div>
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative w-full px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-4xl font-extrabold text-white sm:text-5xl animate-fade-in-up">
                Everything You Need to Run Your Trucking Business
              </h2>
              <p className="mt-6 max-w-3xl text-xl text-gray-300 lg:mx-auto animate-fade-in-up animation-delay-200">
                From business overview and driver management to order creation and subscription-based services, 
                Routico provides the complete toolkit for third-party trucking operations.
              </p>
            </div>

            <div className="mt-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
                <div className="group relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-110">
                      <svg className="h-8 w-8 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300">Business Overview</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Get complete visibility into your trucking operations with real-time dashboards, revenue tracking, and performance metrics.
                    </p>
                  </div>
                </div>

                <div className="group relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 hover:border-green-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg group-hover:shadow-green-500/50 transition-all duration-300 group-hover:scale-110">
                      <svg className="h-8 w-8 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-white group-hover:text-green-400 transition-colors duration-300">Driver Management</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Manage your driver workforce efficiently with scheduling, performance tracking, and communication tools.
                    </p>
                  </div>
                </div>

                <div className="group relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg group-hover:shadow-purple-500/50 transition-all duration-300 group-hover:scale-110">
                      <svg className="h-8 w-8 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-white group-hover:text-purple-400 transition-colors duration-300">Order Creation</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Streamline order processing with easy creation tools, customer management, and automated scheduling systems.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-900 to-gray-800"></div>
          <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative w-full px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-4xl font-extrabold text-white sm:text-5xl animate-fade-in-up">
                Subscription-Based Business Model
              </h2>
              <p className="mt-6 max-w-3xl text-xl text-gray-300 lg:mx-auto animate-fade-in-up animation-delay-200">
                Choose the perfect plan for your trucking business with flexible subscription options and scalable features.
              </p>
            </div>

            <div className="mt-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                <div className="group relative bg-gray-800/30 backdrop-blur-sm rounded-3xl p-8 border border-gray-700/30 hover:border-green-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg group-hover:shadow-green-500/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <svg className="h-8 w-8 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-white group-hover:text-green-400 transition-colors duration-300">Flexible Pricing Plans</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Start small and scale up with subscription plans designed for independent operators to large fleet management companies.
                    </p>
                  </div>
                </div>

                <div className="group relative bg-gray-800/30 backdrop-blur-sm rounded-3xl p-8 border border-gray-700/30 hover:border-blue-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg group-hover:shadow-blue-500/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <svg className="h-8 w-8 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-white group-hover:text-blue-400 transition-colors duration-300">Advanced Analytics</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Get insights into your business performance with detailed analytics, fuel efficiency reports, and profitability tracking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About/Business Tools Section */}
        <section id="about" className="py-20 relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-700 to-gray-800"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative w-full px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-4xl font-extrabold text-white sm:text-5xl animate-fade-in-up">
                Complete Business Management Suite
              </h2>
              <p className="mt-6 max-w-3xl text-xl text-gray-300 lg:mx-auto animate-fade-in-up animation-delay-200">
                Everything you need to run a successful third-party trucking business, from operations to customer management.
              </p>
            </div>

            <div className="mt-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                <div className="group relative bg-gray-800/30 backdrop-blur-sm rounded-3xl p-8 border border-gray-700/30 hover:border-purple-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg group-hover:shadow-purple-500/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <svg className="h-8 w-8 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-white group-hover:text-purple-400 transition-colors duration-300">Route Planning & Optimization</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Intelligent route planning helps reduce fuel costs and improve delivery efficiency across Metro Manila's complex road network.
                    </p>
                  </div>
                </div>

                <div className="group relative bg-gray-800/30 backdrop-blur-sm rounded-3xl p-8 border border-gray-700/30 hover:border-orange-500/50 transition-all duration-500 transform hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg group-hover:shadow-orange-500/50 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
                      <svg className="h-8 w-8 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold text-white group-hover:text-orange-400 transition-colors duration-300">Customer Management</h3>
                    <p className="mt-4 text-gray-300 group-hover:text-gray-200 transition-colors duration-300">
                      Build and maintain relationships with your clients through integrated customer management and communication tools.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-20 relative overflow-hidden bg-gray-900">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900"></div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-96 bg-gradient-to-t from-blue-500/10 to-transparent"></div>
          
          <div className="relative w-full px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl font-extrabold text-white sm:text-5xl animate-fade-in-up">
                Ready to Transform Your Trucking Business?
              </h2>
              <p className="mt-6 text-xl text-gray-300 animate-fade-in-up animation-delay-200">
                Join hundreds of trucking operators already using Routico to manage their business more efficiently.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-400">
                <a
                  href="/register"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  Sign Up Now
                </a>
                <a
                  href="/login"
                  className="px-8 py-4 border-2 border-blue-500 text-blue-400 font-bold rounded-lg hover:bg-blue-500/10 transition-all duration-300 transform hover:scale-105"
                >
                  Sign In
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
