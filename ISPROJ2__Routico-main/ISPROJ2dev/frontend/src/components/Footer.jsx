import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              <span className="text-blue-400">Rout</span>ico
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Comprehensive trucking business management platform for third-party logistics services in Metro Manila.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Business Tools</h3>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-gray-300">Business Overview</a></li>
              <li><a href="#" className="hover:text-gray-300">Driver Management</a></li>
              <li><a href="#" className="hover:text-gray-300">Order Creation</a></li>
              <li><a href="#" className="hover:text-gray-300">Route Planning</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-gray-300">Third-party Trucking</a></li>
              <li><a href="#" className="hover:text-gray-300">Fleet Operations</a></li>
              <li><a href="#" className="hover:text-gray-300">Subscription Plans</a></li>
              <li><a href="#" className="hover:text-gray-300">Business Analytics</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>Email: info@routico.com</li>
              <li>Phone: +63 (2) 123-4567</li>
              <li>Metro Manila, Philippines</li>
              <li>Support: support@routico.com</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p>&copy; 2024 Routico. All rights reserved. | Trucking Business Management Platform</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
