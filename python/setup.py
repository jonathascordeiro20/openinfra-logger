from setuptools import setup, find_packages

setup(
    name="openinfra-logger",
    version="0.1.0",
    description="Critical structured logging and observability library for modern infrastructure",
    author="Jonathas",
    url="https://github.com/jonathascordeiro20/openinfra-logger",
    packages=find_packages(),
    install_requires=[],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.6',
)
