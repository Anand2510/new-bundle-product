import { json } from "@remix-run/node"; 
import { useLoaderData, Link } from "@remix-run/react"; 
import { useState } from "react";
import "./asset/product-page.css"
// Loader function to fetch all products
export const loader = async () => {
  const shop = `beachcafe-uk.myshopify.com`;
  const accessToken = `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`;
  const url = `https://${shop}/admin/api/2023-10/graphql.json`;

  const allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query {
        products(first: 250, after: ${cursor ? `"${cursor}"` : "null"}) {
          edges {
            node {
              id
              title
              images(first: 1) {
                edges {
                  node {
                    src
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query }),
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.errors?.[0]?.message || 'Failed to fetch products');
      }

      const products = data.data.products.edges.map(edge => edge.node);
      allProducts.push(...products);
      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    } catch (error) {
      console.error('Error fetching products:', error);
      return json({ error: 'Failed to fetch products' }, { status: 500 });
    }
  }

  return json(allProducts); // Return all fetched products
};

// Frontend component to render products with search and pagination
export default function ProductsPage() { 
  const products = useLoaderData();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

  // Helper function to convert gid to ID
  const getProductID = (globalID) => {
    return globalID.split('/').pop();
  };

  if (!products || products.length === 0) { 
    return <p>No products available.</p>; 
  } 

  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const rangeSize = 3;

  const selectPageHandler = (selectedPage) => {
    if (selectedPage >= 1 && selectedPage <= totalPages && selectedPage !== page) {
      setPage(selectedPage);
    }
  };

  const getPageRange = () => {
    let start = Math.max(1, page - rangeSize);
    let end = Math.min(totalPages, page + rangeSize);

    const pages = [];

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return ( 
    <div className="bundle-product"> 
      <h1>Products ({filteredProducts.length})</h1> 

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <ul className="products">
        {filteredProducts.slice((page - 1) * itemsPerPage, page * itemsPerPage).map((product) => (
          <li key={product.id} id="pro"> 
            <div className="product-card"> 
              <div className="product-card-img"> 
                {product.images.edges.length > 0 && (
                  <img src={product.images.edges[0].node.src} alt={product.title} style={{ width: "75px" }} /> 
                )} 
              </div> 
              <div className="product-body-content"> 
                <h2>{product.title}</h2> 
                <Link to={`/one/${getProductID(product.id)}`}>
                  View Product
                </Link>
              </div> 
            </div> 
          </li> 
        ))}
      </ul> 

      {/* Pagination controls */}
      <div className="pagination">
        <span
          onClick={() => selectPageHandler(page - 1)}
          className={page > 1 ? "" : "pagination__disable"}
        >
          ◀
        </span>

        {getPageRange().map((pageNumber, index) => (
          <span
            key={index}
            onClick={() => typeof pageNumber === 'number' && selectPageHandler(pageNumber)}
            className={page === pageNumber ? "pagination__selected" : ""}
          >
            {pageNumber}
          </span>
        ))}

        <span
          onClick={() => selectPageHandler(page + 1)}
          className={page < totalPages ? "" : "pagination__disable"}
        >
          ▶
        </span>
      </div>

 
    </div> 
  ); 
}
