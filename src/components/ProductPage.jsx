import { X } from 'lucide-react';
import { ProductStyleImages } from 'react-product-style-images';

const ProductPage = ({ styleNumber, setToggle }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => setToggle((prev) => !prev)}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 p-2 rounded-full text-gray-500 bg-white/80 backdrop-blur hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <X size={22} strokeWidth={2} />
        </button>

        {/* Image */}
        <div className="p-4">
          <ProductStyleImages
            styleNumbers={styleNumber}
            imageCount="1"
            className="w-full rounded-xl"
          />
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
