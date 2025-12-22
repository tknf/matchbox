import type { CgiContext } from "../../../dist";

export default ({ $_GET, $_SESSION }: CgiContext) => {
	const action = $_GET.action;
	const item = $_GET.item;

	let cart = $_SESSION.cart || [];

	if (action === "add" && item) {
		cart.push(item);
		$_SESSION.cart = cart;
	} else if (action === "remove" && item) {
		const index = cart.indexOf(item);
		if (index > -1) {
			cart.splice(index, 1);
			$_SESSION.cart = cart;
		}
	} else if (action === "clear") {
		cart = [];
		$_SESSION.cart = cart;
	}

	const products = ["Apple", "Banana", "Orange", "Grape", "Mango"];

	return (
		<div>
			<h1>Shopping Cart</h1>

			<h2>Products:</h2>
			<ul>
				{products.map((product) => (
					<li key={product}>
						{product} - <a href={`/cart.cgi?action=add&item=${product}`}>Add to Cart</a>
					</li>
				))}
			</ul>

			<h2>Your Cart ({cart.length} items):</h2>
			{cart.length === 0 ? (
				<p>Your cart is empty.</p>
			) : (
				<>
					<ul>
						{cart.map((item: string, index: number) => (
							<li key={index}>
								{item} - <a href={`/cart.cgi?action=remove&item=${item}`}>Remove</a>
							</li>
						))}
					</ul>
					<p>
						<a href="/cart.cgi?action=clear">Clear Cart</a>
					</p>
				</>
			)}

			<p>
				<a href="/">Back to home</a>
			</p>
		</div>
	);
};
