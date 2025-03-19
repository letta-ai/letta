docs=$2
model=$1
baseline=$3
python paper_experiments/doc_qa_task/doc_qa.py --model $model --baseline $baseline --num_docs $docs
