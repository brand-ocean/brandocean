import { Link } from "@tanstack/react-router";
import { Brandmark, Logotype } from "../brand";

interface NavHeaderProps {
	isOpen: boolean;
	onToggle: () => void;
}

export function NavHeader({ isOpen, onToggle }: NavHeaderProps) {
	return (
		<div
			className="relative flex items-center justify-between cursor-pointer"
			style={{
				padding: "1rem 1.5rem",
				backgroundColor: "var(--color-base-300)",
				borderRadius: "8px",
				zIndex: 2,
			}}
			onClick={onToggle}
		>
			<Link
				to="/"
				onClick={(e) => e.stopPropagation()}
				style={{
					display: "flex",
					alignItems: "center",
					gap: "0.625rem",
					textDecoration: "none",
					color: "var(--color-base-100)",
				}}
			>
				<Brandmark size={36} />
				<Logotype height={18} />
			</Link>

			<div
				className="flex items-center"
				style={{ gap: "0.5rem" }}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					onClick={onToggle}
					className="relative flex items-center justify-center bg-transparent border-none cursor-pointer"
					style={{ width: "36px", height: "36px" }}
					aria-label="Toggle menu"
				>
				<span
					style={{
						position: "absolute",
						width: "28px",
						height: "3px",
						backgroundColor: "var(--color-base-100)",
						borderRadius: "1.5px",
						transition: "all 0.3s ease",
						transform: isOpen ? "rotate(45deg)" : "translateY(-6px)",
					}}
				/>
				<span
					style={{
						position: "absolute",
						width: "28px",
						height: "3px",
						backgroundColor: "var(--color-base-100)",
						borderRadius: "1.5px",
						transition: "all 0.3s ease",
						transform: isOpen ? "rotate(-45deg)" : "translateY(6px)",
					}}
				/>
				</button>
			</div>
		</div>
	);
}
