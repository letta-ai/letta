# Make sure to use this base image
# REDO: Consider locking this base image
FROM e2bdev/code-interpreter:latest

# Install dependencies and customize sandbox
RUN pip install 'letta-nightly[postgres,server,cloud-tool-sandbox,external-tools]'
RUN pip install composio-core==0.7.7
RUN pip install composio-langchain==0.7.2
RUN pip install certifi==2024.7.4
RUN pip install charset-normalizer==3.4.0
RUN pip install idna==3.4
RUN pip install joblib==1.3.2
RUN pip install kiwisolver==1.4.5
RUN pip install letta-client==0.1.271
RUN pip install matplotlib==3.10.1
# minimum version of numpy compatible with python3.12
RUN pip install numpy==1.26.4
RUN pip install packaging==24.2
RUN pip install pandas==1.5.3
RUN pip install Pillow==9.4.0
RUN pip install pyparsing==3.1.1
RUN pip install python-dateutil==2.8.2
RUN pip install pytz==2023.3
RUN pip install requests==2.31.0
# sklearn must be > 1.2 otherwise cython imcompatibilities
RUN pip install scikit-learn==1.3.1
RUN pip install scipy==1.11.3
RUN pip install seaborn==0.12.2
RUN pip install six==1.16.0
RUN pip install threadpoolctl==3.2.0
RUN pip install urllib3==2.0.4
