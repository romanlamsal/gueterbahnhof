import { Link } from "@tanstack/react-router"

export default function Header() {
    return (
        <header className={"flex items-center bg-gray-800 p-4 text-white shadow-lg"}>
            <Link to={"/ui"} className={"text-xl font-semibold"}>
                gueterbahnhof 🚂
            </Link>
        </header>
    )
}
