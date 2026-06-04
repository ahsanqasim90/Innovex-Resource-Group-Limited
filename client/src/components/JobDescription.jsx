import { formatJobText } from "../utils/jobText.js";

export default function JobDescription({ text }) {
  const blocks = formatJobText(text);

  return (
    <div className="job-description">
      {blocks.map((block, index) => {
        if (block.type === "heading") return <h3 key={`${block.text}-${index}`}>{block.text}</h3>;
        if (block.type === "list") {
          return (
            <ul className="clean-list" key={`list-${index}`}>
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        return <p key={`${block.text}-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}
