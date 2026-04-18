
export function Footer() {
  return (
    <footer className="py-6 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-2">
          <p className="text-sm text-gray-500 font-medium">
            HikmahHub
          </p>
          <p className="text-xs text-gray-400 text-center max-w-md">
            HikmahHub is an independent student platform and is not officially affiliated with Al-Hikmah University.
          </p>
          <p className="text-[10px] text-gray-400">
            &copy; {new Date().getFullYear()} HikmahHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
