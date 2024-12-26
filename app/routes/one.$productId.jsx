// ProductPage.jsx

import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import React, { useState, useEffect } from "react";
import fetch from "node-fetch";
import "./asset/style.css"

// Loader function to fetch product data and all products
export const loader = async ({ params }) => {
  const { productId } = params;
  const shop = "beachcafe-uk.myshopify.com";
  const accessToken = "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";
  const graphqlUrl = `https://${shop}/admin/api/2023-10/graphql.json`;

  const productQuery = `
    query ($id: ID!) {
      product(id: $id) {
        id
        title
        bodyHtml
        images(first: 1) {
          edges {
            node {
              src
            }
          }
        }
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
        metafields(first: 10, namespace: "custombottom") {
          edges {
            node {
              id
              namespace
              key
              type
              value
              reference {
                ... on Product {
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
            }
          }
        }
      }
    }
  `;

  const allProductsQuery = `
    query {
      products(first: 250) {
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
      }
    }
  `;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
  };

  try {
    const [productResponse, allProductsResponse] = await Promise.all([
      fetch(graphqlUrl, {
        ...options,
        body: JSON.stringify({
          query: productQuery,
          variables: { id: `gid://shopify/Product/${productId}` },
        }),
      }),
      fetch(graphqlUrl, {
        ...options,
        body: JSON.stringify({ query: allProductsQuery }),
      }),
    ]);

    const productData = await productResponse.json();
    const allProductsData = await allProductsResponse.json();

    if (productData.errors || allProductsData.errors) {
      throw new Error("Failed to fetch data");
    }

    const metafields = productData.data.product.metafields.edges.reduce((acc, edge) => {
      acc[edge.node.key] = edge.node.reference;
      return acc;
    }, {});

    return json({
      product: productData.data.product,
      allProducts: allProductsData.data.products.edges.map((edge) => edge.node),
      selectedTopProduct: metafields.top_product || null,
      selectedBottomProduct: metafields.bottom_product || null,
    });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: "Failed to fetch product or products" }, { status: 500 });
  }
};

// Action function to create metafield when product is selected
export const action = async ({ request, params }) => {
  const { productId } = params;
  const shop = "beachcafe-uk.myshopify.com";
  const accessToken = "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";
  const graphqlUrl = `https://${shop}/admin/api/2023-10/graphql.json`;

  const formData = await request.formData();
  const selectedProductId = formData.get("selectedProductId");
  const metafieldKey = formData.get("metafieldKey");

  const createProductMetafieldMutation = `
    mutation CreateMetafield($productId: ID!, $value: String!, $key: String!) {
      metafieldsSet(metafields: [
        {
          ownerId: $productId,
          namespace: "custombottom",
          key: $key,
          type: "product_reference",
          value: $value
        }
      ]) {
        metafields {
          id
          namespace
          key
          type
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query: createProductMetafieldMutation,
      variables: {
        productId: `gid://shopify/Product/${productId}`,
        value: selectedProductId,
        key: metafieldKey,
      },
    }),
  });

  const result = await response.json();

  if (result.errors || !result.data || !result.data.metafieldsSet) {
    const errorMessage = result.errors ? result.errors[0].message : "Metafield creation failed.";
    console.error("Error:", errorMessage);
    throw new Error(errorMessage);
  }

  if (result.data.metafieldsSet.userErrors.length > 0) {
    throw new Error(result.data.metafieldsSet.userErrors[0].message);
  }

  return json({ success: true });
};

// Frontend component
export default function ProductPage() {
  const { product, allProducts, selectedTopProduct, selectedBottomProduct } = useLoaderData();
  const fetcher = useFetcher();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [metafieldKey, setMetafieldKey] = useState("top_product");
  const [searchTerm, setSearchTerm] = useState("");
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [page, setPage] = useState(1);

  const openModal = (key) => {
    setMetafieldKey(key);
    setIsModalOpen(true);
    setDisplayedProducts(allProducts.slice(0, 20));
    setPage(1);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleProductSelect = (productId) => {
    const selectedProduct = allProducts.find((p) => p.id === productId);
    setSelectedProduct(selectedProduct);

    fetcher.submit(
      { selectedProductId: productId, metafieldKey },
      { method: "post" }
    );
    closeModal();
  };

  const loadMoreProducts = () => {
    const newProducts = allProducts.slice(page * 20, (page + 1) * 20);
    setDisplayedProducts((prev) => [...prev, ...newProducts]);
    setPage(page + 1);
  };

  useEffect(() => {
    const filteredProducts = allProducts.filter((product) =>
      product.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setDisplayedProducts(filteredProducts.slice(0, page * 20));
  }, [searchTerm, allProducts, page]);
 
  return (
    <div className="single-product">
      
      <div className="product-details">
        <div class="product-section">
          <div class="product-img">
        {product.images?.edges.length > 0 && (
          <img src={product.images.edges[0].node.src} alt={product.title} style={{ width: "" }} />
        )}
          <h1>{product.title}</h1>
          <p>Price: {product.variants.edges[0]?.node.price}</p>
        </div>
        <div class="select-sub">
      
      <h1>Select Top And Bottom Product</h1>
        {/* <h1>{product.title}</h1>
        <p>Price: {product.variants.edges[0]?.node.price}</p> */} 
        <div class="select-top-product"> 
          <div class="select-top-button">
          <span class="span" >Select Top Product</span>
          <button class="select-btn" onClick={() => openModal("top_product")}>Select</button>
          </div>
        {selectedTopProduct && (
          <div className="selected-product">
           
            {/* <h3>Selected Top Product:</h3> */}
            <div className="product-item">
              <img src={selectedTopProduct.images.edges[0].node.src} alt={selectedTopProduct.title} />
              <p>{selectedTopProduct.title}</p>
              <button onClick={() => openModal("top_product")}>Change</button>
            </div>
          </div>
        )}

        </div>
        <div class="select-top-product"> 
          <div class="select-top-button">
          <span class="span">Select Bottom Product</span>
          <button class="select-btn" onClick={() => openModal("bottom_product")}>Select</button>
          </div>
          {selectedBottomProduct && (
          <div className="selected-product">
            {/* <h3>Selected Bottom Product:</h3> */}
            <div className="product-item">
              <img src={selectedBottomProduct.images.edges[0].node.src} alt={selectedBottomProduct.title} />
              <p>{selectedBottomProduct.title}</p>
              <button onClick={() => openModal("bottom_product")}>Cahnge</button>
            </div>
          </div>
        )}

        </div>

 </div>
 </div>
        {isModalOpen && (
          <div className="modal">
            <div className="modal-overlay" onClick={closeModal}></div>
            <div className="modal-content">
              <div className="modal-header">
                <h2>Select Product</h2>
                <button className="close-button" onClick={closeModal}>×</button>
              </div>
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-bar"
              />
              <ul className="product-list">
                {displayedProducts.map((product) => (
                  <li key={product.id} onClick={() => handleProductSelect(product.id)} className="product-item">
                    <img src={product.images.edges[0]?.node.src} alt={product.title} />
                    <span>{product.title}</span>
                  </li>
                ))}
              </ul>
              {displayedProducts.length < allProducts.length && (
                <button onClick={loadMoreProducts} className="load-more">Load more</button>
              )}
            </div>
          </div>
        )}
      </div>


      <style jsx>{`
     
      `}</style>
    </div>
  );
}
